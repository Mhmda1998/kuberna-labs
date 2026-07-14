import axios from 'axios';

export const DUBSTRATA_BASE_URL = 'https://api.dubstrata.com/api/v1';

export interface DubstrataConfig {
  apiKey?: string;
  baseUrl?: string;
  timeout?: number;
  tenantId?: string;
}

export interface QueryRequest {
  query: string;
  is_private?: boolean;
}

export interface IngestRequest {
  url: string;
  text?: string;
  is_private?: boolean;
  schema?: string;
}

export interface FeedbackRequest {
  log_id: string;
  score: number;
}

export interface AgentWalletUpdateRequest {
  new_wallet_address: string;
  signature: string;
}

export interface IntelligenceReportRequest {
  query: string;
  is_private?: boolean;
}

export interface Claim {
  id: string;
  argument: string;
  evidence: string;
  source_url: string;
  domain: string | null;
  target_date: string | null;
  last_seen_at: number | null;
  similarity_score: number;
}

export interface Relation {
  subject: string;
  predicate: string;
  object: string;
  source_url: string;
  domain: string | null;
  target_date: string | null;
  last_seen_at: number | null;
}

export interface Source {
  url: string;
  abstract: string;
  domain: string | null;
  target_date: string | null;
  confidence_score: number;
  market_sentiment: string;
}

export interface PriceAction {
  ticker: string;
  cik?: string;
  assets?: number;
  liabilities?: number;
  net_income?: number;
  pe_ratio?: string;
  peg_ratio?: string;
  debt_to_equity?: string;
  price?: number;
  change_24h_percent?: number | null;
  high_24h?: number | null;
  low_24h?: number | null;
  volume_24h?: number | null;
  return_1m_percent?: number;
  return_6m_percent?: number;
  return_1y_percent?: number;
  historical_volatility_40d?: number;
  altman_z_score?: number;
  status?: string;
}

export interface StructuredQueryResult {
  code: string;
  message: string;
  claims?: Claim[];
  relations?: Relation[];
  sources?: Source[];
  price_action?: PriceAction[];
  log_id: string;
  trademark: string;
  remaining_balance: number;
  execution_cost: number;
}

export interface IntelligenceReport {
  bluf: string;
  scope: string;
  context: string;
  key_findings: string[];
  source_evaluation: string;
  analysis: string;
  threats_risks: string;
  alternative_scenarios: string;
  outlook: string;
  intelligence_gaps: string;
}

export interface StructuredReportResult {
  code: string;
  message: string;
  report: IntelligenceReport;
  claims?: Claim[];
  relations?: Relation[];
  sources?: Source[];
  price_action?: PriceAction[];
  log_id: string;
  trademark: string;
  remaining_balance: number;
  execution_cost: number;
}

export interface IngestResult {
  code: string;
  message: string;
  log_id: string;
  trademark: string;
  remaining_balance: number;
  execution_cost: number;
}

export interface FeedbackResult {
  status: string;
  message: string;
  log_id: string;
}

export interface AgentWalletUpdateResult {
  status: string;
  message: string;
  tenant_agent_id: string;
  old_wallet_address: string;
  new_wallet_address: string;
}

export interface DubstrataResponseBase {
  result?: string;
  status: string;
  aggregate_sentiment_score: number;
  graph_implied_trust_index: number;
  causal_magnitude: number;
  log_id: string;
  trademark: string;
  remaining_balance: number;
  execution_cost: number;
}

export interface QueryResponse extends DubstrataResponseBase {
  structured_result: StructuredQueryResult;
}

export interface IntelligenceReportResponse extends DubstrataResponseBase {
  structured_result: StructuredReportResult;
}

export interface IngestResponse {
  result?: string;
  status?: string;
  structured_result: IngestResult;
  log_id: string;
  trademark: string;
  remaining_balance: number;
  execution_cost: number;
}

export class DubstrataError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public response?: unknown,
  ) {
    super(message);
    this.name = 'DubstrataError';
  }
}

export class DubstrataManager {
  private apiKey: string;
  private baseUrl: string;
  private timeout: number;

  constructor(config: DubstrataConfig = {}) {
    this.apiKey = config.apiKey || process.env.DUBSTRATA_API_KEY || '';
    this.baseUrl = config.baseUrl || DUBSTRATA_BASE_URL;
    this.timeout = config.timeout || 30000;
  }

  setApiKey(apiKey: string): void {
    this.apiKey = apiKey;
  }

  private getHeaders(): Record<string, string> {
    if (!this.apiKey) {
      throw new DubstrataError(
        'Dubstrata API key is required. Set it via config or DUBSTRATA_API_KEY env var.',
      );
    }
    return {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };
  }

  private async request<T>(path: string, data: Record<string, unknown>): Promise<T> {
    try {
      const response = await axios.post<T>(`${this.baseUrl}${path}`, data, {
        headers: this.getHeaders(),
        timeout: this.timeout,
      });
      return response.data;
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        throw new DubstrataError(
          error.response?.data?.message || error.message || 'Dubstrata API request failed',
          error.response?.status,
          error.response?.data,
        );
      }
      throw error;
    }
  }

  async query(params: QueryRequest): Promise<QueryResponse> {
    return this.request<QueryResponse>('/query', {
      query: params.query,
      is_private: params.is_private ?? false,
    });
  }

  async waitForQuery(
    params: QueryRequest,
    options: { maxRetries?: number; intervalMs?: number } = {},
  ): Promise<QueryResponse> {
    const maxRetries = options.maxRetries ?? 12;
    const intervalMs = options.intervalMs ?? 5000;

    for (let i = 0; i < maxRetries; i++) {
      const result = await this.query(params);
      if (result.status === 'complete') {
        return result;
      }
      if (i < maxRetries - 1) {
        await new Promise((r) => setTimeout(r, intervalMs));
      }
    }

    throw new DubstrataError(
      `Query did not complete after ${maxRetries} retries (${(maxRetries * intervalMs) / 1000}s)`,
    );
  }

  async intelligenceReport(params: IntelligenceReportRequest): Promise<IntelligenceReportResponse> {
    return this.request<IntelligenceReportResponse>('/query/intelligence-report', {
      query: params.query,
      is_private: params.is_private ?? false,
    });
  }

  async ingest(params: IngestRequest): Promise<IngestResponse> {
    return this.request<IngestResponse>('/ingest', {
      url: params.url,
      text: params.text,
      is_private: params.is_private ?? false,
      schema: params.schema,
    });
  }

  async feedback(params: FeedbackRequest): Promise<FeedbackResult> {
    return this.request<FeedbackResult>('/feedback', {
      log_id: params.log_id,
      score: params.score,
    });
  }

  async updateAgentWallet(params: AgentWalletUpdateRequest): Promise<AgentWalletUpdateResult> {
    return this.request<AgentWalletUpdateResult>('/auth/agent/update', {
      new_wallet_address: params.new_wallet_address,
      signature: params.signature,
    });
  }
}
