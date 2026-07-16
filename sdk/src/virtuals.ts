import axios from 'axios';

export const VIRTUALS_COMPUTE_URL = 'https://compute.virtuals.io/v1';
export const VIRTUALS_ACP_URL = 'https://api.virtuals.io';
export const VIRTUALS_WS_URL = 'wss://app.virtuals.io/acp/agents';

export interface VirtualsConfig {
  apiKey?: string;
  computeUrl?: string;
  acpUrl?: string;
  timeout?: number;
}

export interface VirtualsModel {
  id: string;
  name: string;
  description: string;
  contextLength: number;
  pricing: {
    input: number;
    output: number;
    cacheInput: number | null;
  };
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatParams {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
}

export interface ChatResult {
  content: string;
  model: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  cost: number;
}

export interface ComputeBalance {
  balance: number;
  currency: string;
  autoTopUp: {
    enabled: boolean;
    amount: number;
    threshold: number;
    chain: string;
  };
}

export interface ACPOffering {
  id: string;
  name: string;
  description: string;
  priceType: 'fixed' | 'hourly' | 'milestone';
  priceValue: number;
  slaMinutes: number;
  requirements: Record<string, unknown>;
  deliverable: string;
  providerAddress: string;
  active: boolean;
}

export interface ACPJob {
  id: number;
  chainId: number;
  offeringId: string;
  clientAddress: string;
  providerAddress: string;
  status: 'pending' | 'budget_set' | 'funded' | 'submitted' | 'completed' | 'rejected' | 'expired';
  fee: number;
  fundTransferAmount?: number;
  createdAt: string;
}

export interface ACPServiceEvent {
  kind: 'system' | 'message';
  type?: 'job.created' | 'budget.set' | 'job.funded' | 'job.submitted' | 'job.completed' | 'job.rejected' | 'job.expired';
  from?: string;
  content?: string;
  contentType?: 'text' | 'proposal' | 'deliverable' | 'structured' | 'requirement';
  session?: {
    jobId: number;
    chainId: number;
    role: 'client' | 'provider' | 'evaluator';
    status: string;
  };
}

export interface AgentIdentity {
  walletAddress: string;
  agentAddress?: string;
  builderCode?: string;
  chainId?: number;
}

export class VirtualsError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public response?: unknown,
  ) {
    super(message);
    this.name = 'VirtualsError';
  }
}

export class VirtualsManager {
  private apiKey: string;
  private computeUrl: string;
  private acpUrl: string;
  private timeout: number;

  constructor(config: VirtualsConfig = {}) {
    this.apiKey = config.apiKey || process.env.VIRTUALS_API_KEY || process.env.VIRTUAL_API_KEY || process.env.AI_API_KEY || '';
    this.computeUrl = config.computeUrl || VIRTUALS_COMPUTE_URL;
    this.acpUrl = config.acpUrl || VIRTUALS_ACP_URL;
    this.timeout = config.timeout || 30000;
  }

  setApiKey(key: string): void {
    this.apiKey = key;
  }

  private getHeaders(): Record<string, string> {
    if (!this.apiKey) {
      throw new VirtualsError(
        'Virtuals API key required. Set via config, VIRTUAL_API_KEY, or AI_API_KEY.',
      );
    }
    return {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };
  }

  private async computeRequest<T>(path: string, data?: Record<string, unknown>): Promise<T> {
    try {
      const url = `${this.computeUrl}${path}`;
      const method = data ? 'POST' : 'GET';
      const response = await axios.request<T>({
        method,
        url,
        data,
        headers: this.getHeaders(),
        timeout: this.timeout,
      });
      return response.data;
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        throw new VirtualsError(
          error.response?.data?.error?.message || error.message || 'Virtuals compute request failed',
          error.response?.status,
          error.response?.data,
        );
      }
      throw error;
    }
  }

  async listModels(): Promise<VirtualsModel[]> {
    const response = await this.computeRequest<{ data: VirtualsModel[] }>('/models');
    return response.data;
  }

  async chat(params: ChatParams): Promise<ChatResult> {
    const response = await this.computeRequest<{
      choices: Array<{ message: { content: string } }>;
      model: string;
      usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
      cost?: { usd?: number };
    }>('/chat/completions', {
      model: params.model,
      messages: params.messages,
      temperature: params.temperature ?? 0.3,
      max_tokens: params.maxTokens ?? 2000,
    });

    return {
      content: response.choices[0]?.message?.content || '',
      model: response.model,
      usage: {
        promptTokens: response.usage.prompt_tokens,
        completionTokens: response.usage.completion_tokens,
        totalTokens: response.usage.total_tokens,
      },
      cost: response.cost?.usd || 0,
    };
  }

  async chatStream(
    params: ChatParams,
    onChunk: (chunk: string) => void,
  ): Promise<ChatResult> {
    const response = await fetch(`${this.computeUrl}/chat/completions`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        model: params.model,
        messages: params.messages,
        temperature: params.temperature ?? 0.3,
        max_tokens: params.maxTokens ?? 2000,
        stream: true,
      }),
    });

    if (!response.ok) {
      throw new VirtualsError(`Stream request failed: ${response.status}`, response.status);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new VirtualsError('No response body for stream');

    const decoder = new TextDecoder();
    let fullContent = '';
    let usage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
    let cost = 0;
    let model = params.model;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n').filter((l) => l.startsWith('data: '));

      for (const line of lines) {
        const data = line.slice(6).trim();
        if (data === '[DONE]') continue;

        try {
          const parsed = JSON.parse(data);
          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta) {
            fullContent += delta;
            onChunk(delta);
          }
          if (parsed.model) model = parsed.model;
          if (parsed.usage) {
            usage = {
              promptTokens: parsed.usage.prompt_tokens || 0,
              completionTokens: parsed.usage.completion_tokens || 0,
              totalTokens: parsed.usage.total_tokens || 0,
            };
          }
          if (parsed.cost?.usd) cost = parsed.cost.usd;
        } catch {
          // skip unparseable lines
        }
      }
    }

    return { content: fullContent, model, usage, cost };
  }

  async checkComputeBalance(): Promise<ComputeBalance> {
    const resp = await this.computeRequest<{
      balance: number;
      currency: string;
      auto_top_up?: {
        enabled: boolean;
        amount: number;
        threshold: number;
        preferred_chain: string;
      };
    }>('/compute/balance');

    return {
      balance: resp.balance,
      currency: resp.currency,
      autoTopUp: resp.auto_top_up
        ? {
            enabled: resp.auto_top_up.enabled,
            amount: resp.auto_top_up.amount,
            threshold: resp.auto_top_up.threshold,
            chain: resp.auto_top_up.preferred_chain,
          }
        : { enabled: false, amount: 0, threshold: 0, chain: '' },
    };
  }

  async registerACPOffering(offering: Omit<ACPOffering, 'id' | 'active' | 'providerAddress'>): Promise<ACPOffering> {
    const response = await axios.post<ACPOffering>(
      `${this.acpUrl}/api/v1/offerings`,
      offering,
      { headers: this.getHeaders(), timeout: this.timeout },
    );
    return response.data;
  }

  async listACPOfferings(): Promise<ACPOffering[]> {
    const response = await axios.get<{ offerings: ACPOffering[] }>(
      `${this.acpUrl}/api/v1/offerings`,
      { headers: this.getHeaders(), timeout: this.timeout },
    );
    return response.data.offerings;
  }

  async getACPJobs(): Promise<ACPJob[]> {
    const response = await axios.get<{ jobs: ACPJob[] }>(
      `${this.acpUrl}/api/v1/jobs`,
      { headers: this.getHeaders(), timeout: this.timeout },
    );
    return response.data.jobs;
  }

  async getACPJob(jobId: number, chainId: number): Promise<ACPJob> {
    const response = await axios.get<ACPJob>(
      `${this.acpUrl}/api/v1/jobs/${jobId}?chainId=${chainId}`,
      { headers: this.getHeaders(), timeout: this.timeout },
    );
    return response.data;
  }
}
