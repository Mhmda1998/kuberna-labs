export type IdScheme = 'erc-8004' | 'aip' | 'did';
export type VerifierType = 'zktls' | 'tee' | 'onchain_tx' | 'signed_log';
export type AttestationScheme = 'tlsn-v1' | 'nitro-enclave' | 'sp1' | 'hybrid';
export type ExpireBehavior = 'revert' | 'release' | 'extend';
export type IntentStatus = 'draft' | 'issued' | 'matched' | 'in_flight' | 'proven' | 'settled' | 'disputed' | 'resolved' | 'expired' | 'cancelled';
export type ActionStatus = 'pending' | 'executing' | 'completed' | 'failed' | 'skipped';

export interface Executor {
  agent_id: string;
  id_scheme: IdScheme;
  commitment?: string;
}

export interface VerifierMap {
  [key: string]: string;
}

export interface Attestation {
  type: VerifierType[];
  scheme: AttestationScheme;
  verifier: VerifierMap;
  fallback?: string;
}

export interface Constraints {
  budget?: string;
  deadline?: string;
  jurisdiction?: string[];
  allowed_tools?: string[];
  max_gas?: string;
}

export interface SuccessCriteria {
  type: string;
  conditions: Record<string, unknown>[];
}

export interface OmWorldIntent {
  id: string;
  principal: string;
  body: string;
  constraints?: Constraints;
  success_criteria?: SuccessCriteria;
  executor?: Executor;
  attestation?: Attestation;
  on_expire?: ExpireBehavior;
  nonce: string;
  issued_at: string;
  expires_at?: string;
  signature?: string;
}

export interface OmWorldIntentBundle {
  intent: OmWorldIntent;
  status?: IntentStatus;
  fulfillment?: ExecutionProof;
  chain_id?: number;
  created_at?: string;
  updated_at?: string;
}

export interface Mandate {
  spec_version: string;
  intent_id: string;
  agent: string;
  agent_scheme: IdScheme;
  plan_hash: string;
  bond: string;
  fee_quote: string;
  tools_declared: string[];
  deadline: string;
  issued_at: string;
  signature?: string;
}

export interface StepRecord {
  index: number;
  tool: string;
  input: unknown;
  output: unknown;
  prev_hash: string;
  input_hash: string;
  output_hash: string;
  context_hash?: string;
  timestamp: string;
  signature?: string;
}

export interface Artifact {
  name: string;
  type: string;
  uri: string;
  hash: string;
  description?: string;
}

export interface SuccessClaim {
  outcome: 'success' | 'failure' | 'partial';
  summary: string;
  evidence_hash?: string;
}

export interface ExecutionProof {
  spec_version: string;
  intent_id: string;
  mandate_id: string;
  plan: string;
  steps: StepRecord[];
  artifacts: Artifact[];
  success_claim: SuccessClaim;
  signature?: string;
}

export interface ToolRegistryEntry {
  tool_id: string;
  name: string;
  description: string;
  implementation: string;
  schema: Record<string, unknown>;
  permission_level: 'public' | 'trusted' | 'admin';
  cost_gas?: string;
}

export interface AgentIdentityRecord {
  tokenId: string;
  agentAddress: string;
  name: string;
  framework: string;
  reputationScore: number;
  successRate: number;
  starRating: number;
  badges: string[];
  totalTasks: number;
  successfulTasks: number;
  metadataURI: string;
  chainId: number;
}
