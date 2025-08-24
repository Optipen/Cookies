import { useMemo } from "react";

export function useCrypto(setState) {
  const stake = useMemo(() => (amt = 0.001) => {
    setState((s) => {
      if ((s.crypto.balance || 0) < amt) return s;
      const balance = Number((s.crypto.balance - amt).toFixed(6));
      const staked = Number(((s.crypto.staked || 0) + amt).toFixed(6));
      return { ...s, crypto: { ...s.crypto, balance, staked } };
    });
  }, [setState]);

  const unstake = useMemo(() => (amt = 0.001) => {
    setState((s) => {
      if ((s.crypto.staked || 0) < amt) return s;
      const balance = Number((s.crypto.balance + amt).toFixed(6));
      const staked = Number(((s.crypto.staked || 0) - amt).toFixed(6));
      return { ...s, crypto: { ...s.crypto, balance, staked } };
    });
  }, [setState]);

  return { stake, unstake };
}



