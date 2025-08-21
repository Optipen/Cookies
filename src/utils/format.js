export const fmt = (n) => {
  if (!isFinite(n)) return "∞";
  const suf = ["", "K", "M", "B", "T", "Qa", "Qi", "Sx", "Sp", "Oc", "No", "Dc"];
  let i = 0;
  while (n >= 1000 && i < suf.length - 1) { n /= 1000; i++; }
  return (Math.round(n * 100) / 100).toLocaleString(undefined, { maximumFractionDigits: 2 }) + suf[i];
};

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
