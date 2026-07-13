import type { KubernaNormalizedIntent } from '../intent-types.js';
import type { StructuredIntent } from '../intent.js';
import type { OmWorldIntent, Executor, Attestation, Constraints, SuccessCriteria } from './omworld-types.js';
import { jcsCanonicalize } from './jcs.js';

export function kubernaToOmWorld(
  kubernaIntent: KubernaNormalizedIntent,
  options?: {
    principal?: string;
    body?: string;
    executor?: Executor;
    attestation?: Attestation;
    constraints?: Constraints;
    successCriteria?: SuccessCriteria;
  }
): OmWorldIntent {
  const now = new Date();
  const nonce = kubernaIntent.nonce || `${now.getTime()}-${Math.random().toString(36).slice(2)}`;

  const body = options?.body
    || `Swap ${kubernaIntent.originAmount} ${kubernaIntent.originToken} on chain ${kubernaIntent.originChainId}`
    + ` for ${kubernaIntent.destinationAmount} ${kubernaIntent.destinationToken} on chain ${kubernaIntent.destinationChainId}`;

  const intent: OmWorldIntent = {
    id: '',
    principal: options?.principal || kubernaIntent.swapper || kubernaIntent.signer || '',
    body,
    constraints: options?.constraints ?? {
      deadline: new Date(Number(kubernaIntent.deadline) * 1000).toISOString(),
      allowed_tools: ['cross_chain_swap'],
    },
    executor: options?.executor,
    attestation: options?.attestation ?? (kubernaIntent.attestationRequired ? {
      type: ['tee'],
      scheme: 'nitro-enclave',
      verifier: {},
    } : undefined),
    nonce,
    issued_at: now.toISOString(),
    expires_at: new Date(Number(kubernaIntent.deadline) * 1000).toISOString(),
  };

  if (options?.successCriteria) {
    intent.success_criteria = options.successCriteria;
  }

  return intent;
}

export function structuredToOmWorld(
  structured: StructuredIntent,
  options?: {
    principal?: string;
    body?: string;
    executor?: Executor;
    attestation?: Attestation;
  }
): OmWorldIntent {
  const now = new Date();
  const nonce = `${now.getTime()}-${Math.random().toString(36).slice(2)}`;

  const body = options?.body
    || structured.rawDescription
    || `Swap ${structured.sourceAmount} ${structured.sourceToken} → ${structured.destToken} on ${structured.destChain}`;

  const intent: OmWorldIntent = {
    id: '',
    principal: options?.principal || '',
    body,
    constraints: {
      budget: structured.budget?.toString(),
      deadline: new Date(Date.now() + structured.timeoutSeconds * 1000).toISOString(),
    },
    executor: options?.executor,
    attestation: options?.attestation,
    nonce,
    issued_at: now.toISOString(),
    expires_at: new Date(Date.now() + structured.timeoutSeconds * 1000).toISOString(),
  };

  return intent;
}

export function omWorldToKubernaNormalized(intent: OmWorldIntent): KubernaNormalizedIntent {
  return {
    standard: 'kuberna',
    originalFormat: 'kuberna',
    nonce: intent.nonce,
    deadline: intent.expires_at ? BigInt(new Date(intent.expires_at).getTime()) : BigInt(0),
    swapper: intent.principal,
    originChainId: BigInt(0),
    destinationChainId: BigInt(0),
    originToken: '',
    originAmount: BigInt(0),
    destinationToken: '',
    destinationAmount: BigInt(0),
    destinationRecipient: '',
    signer: intent.principal,
    fillDeadline: intent.expires_at ? BigInt(new Date(intent.expires_at).getTime()) : BigInt(0),
    message: intent.body,
    attestationRequired: !!intent.attestation,
  };
}

export async function computeIntentId(intent: Omit<OmWorldIntent, 'id' | 'signature'>): Promise<string> {
  const canonical = jcsCanonicalize(intent);
  const encoder = new TextEncoder();
  const data = encoder.encode(canonical);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return '0x' + hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export function canonicalIntentJson(intent: OmWorldIntent): string {
  const withoutSig = { ...intent };
  delete withoutSig.signature;
  return jcsCanonicalize(withoutSig);
}
