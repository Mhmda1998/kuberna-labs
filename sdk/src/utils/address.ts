import { ethers } from 'ethers';

export function validateEthAddress(address: string, name = 'address') {
  if (!address || typeof address !== 'string') {
    throw new Error(`Invalid ${name}: must be a non-empty string`);
  }
  if (!ethers.isAddress(address)) {
    throw new Error(`Invalid ${name}: not a valid Ethereum address`);
  }
}
