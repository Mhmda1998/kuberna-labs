import { ethers } from 'ethers';
import type { Provider, Signer } from 'ethers';
import { IdentityResolver } from './identity-resolver.js';
import { VerifierRouterClient } from './verifier-router.js';
import { ExecutionProofBuilder } from './execution-proof.js';
import { MandateBuilder } from './mandate.js';
import { kubernaToOmWorld, structuredToOmWorld, computeIntentId } from './intent-translator.js';
import type {
  OmWorldIntent,
  ExecutionProof,
  Mandate,
  AgentIdentityRecord,
  Executor,
  Attestation,
} from './omworld-types.js';
import type { KubernaNormalizedIntent } from '../intent-types.js';
import type { StructuredIntent } from '../intent.js';

export interface Erc8004AdapterConfig {
  verifierRouterAddress?: string;
  defaultChainId?: number;
  reputationNftAddress?: string;
}

export class Erc8004Adapter {
  public identity: IdentityResolver;
  public proof: ExecutionProofBuilder;
  public mandate: MandateBuilder;
  private verifierRouter?: VerifierRouterClient;
  private config: Required<Erc8004AdapterConfig>;

  constructor(config: Erc8004AdapterConfig = {}) {
    this.identity = new IdentityResolver();
    this.proof = new ExecutionProofBuilder();
    this.mandate = new MandateBuilder();
    this.config = {
      verifierRouterAddress: config.verifierRouterAddress || '',
      defaultChainId: config.defaultChainId || 84532,
      reputationNftAddress: config.reputationNftAddress || '',
    };
  }

  connectVerifierRouter(address: string, providerOrSigner: Provider | Signer): void {
    this.verifierRouter = new VerifierRouterClient(address, providerOrSigner);
  }

  getVerifierRouter(): VerifierRouterClient {
    if (!this.verifierRouter) {
      throw new Error('VerifierRouter not connected. Call connectVerifierRouter() first.');
    }
    return this.verifierRouter;
  }

  async resolveAgentIdentity(
    tokenId: bigint,
    provider: Provider,
    chainId?: number
  ): Promise<AgentIdentityRecord> {
    return this.identity.resolveAgent(tokenId, provider, chainId || this.config.defaultChainId);
  }

  async createIntentFromKubernaNormalized(
    kubernaIntent: KubernaNormalizedIntent,
    options?: {
      principal?: string;
      body?: string;
      executor?: Executor;
      attestation?: Attestation;
      sign?: (hash: string) => Promise<string>;
    }
  ): Promise<OmWorldIntent> {
    const intent = kubernaToOmWorld(kubernaIntent, options);
    const id = await computeIntentId(intent);
    intent.id = id;

    if (options?.sign) {
      const signature = await options.sign(id);
      intent.signature = signature;
    }

    return intent;
  }

  async createIntentFromStructured(
    structured: StructuredIntent,
    options?: {
      principal?: string;
      body?: string;
      executor?: Executor;
      attestation?: Attestation;
      sign?: (hash: string) => Promise<string>;
    }
  ): Promise<OmWorldIntent> {
    const intent = structuredToOmWorld(structured, options);
    const id = await computeIntentId(intent);
    intent.id = id;

    if (options?.sign) {
      const signature = await options.sign(id);
      intent.signature = signature;
    }

    return intent;
  }

  async produceExecutorCommitment(
    agentId: string,
    intentId: string,
    signer: ethers.Signer
  ): Promise<string> {
    return this.identity.produceExecutorCommitment(agentId, intentId, signer);
  }

  async buildExecutionProof(
    options: Parameters<ExecutionProofBuilder['build']>[0]
  ): Promise<ExecutionProof> {
    return this.proof.build(options);
  }

  async buildMandate(
    options: Parameters<MandateBuilder['build']>[0]
  ): Promise<Mandate> {
    return this.mandate.build(options);
  }

  async verifyProof(
    attestationType: string,
    proof: string,
    intentId: string
  ): Promise<boolean> {
    return this.getVerifierRouter().verify(attestationType, proof, intentId);
  }

  clearCache(): void {
    this.identity.clearCache();
  }
}
