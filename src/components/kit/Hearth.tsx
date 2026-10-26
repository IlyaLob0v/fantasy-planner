import { motion } from "motion/react";

/** Камин героя: горит, когда герой бодр, и тлеет углями при усталости. */
export function Hearth({ lit, className = "h-14 w-14" }: { lit: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <path d="M8 60V26L32 10l24 16v34Z" fill="#3a2a20" stroke="#c9a24a" strokeOpacity="0.4" />
      <path d="M18 60V38a14 14 0 0 1 28 0v22Z" fill="#120c09" />
      <rect x="20" y="54" width="24" height="4" rx="2" fill="#5a3a24" />
      <motion.g
        initial={false}
        animate={{ opacity: lit ? 1 : 0, scale: lit ? 1 : 0.5 }}
        transition={{ duration: 1.5 }}
        style={{ originX: "32px", originY: "54px" }}
      >
        <motion.path
          d="M32 30c6 7 9 11 9 16a9 9 0 0 1-18 0c0-5 3-9 9-16Z"
          fill="#d9772b"
          animate={lit ? { scaleY: [1, 1.08, 0.96, 1] } : {}}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
          style={{ originX: "32px", originY: "54px" }}
        />
        <path d="M32 38c3 4 5 6 5 9a5 5 0 0 1-10 0c0-3 2-5 5-9Z" fill="#f0c45a" />
      </motion.g>
      <motion.g initial={false} animate={{ opacity: lit ? 0 : 1 }} transition={{ duration: 1.5 }}>
        <circle cx="27" cy="53" r="2" fill="#b3471e" />
        <circle cx="33" cy="52" r="2.4" fill="#d9772b" opacity="0.8" />
        <circle cx="38" cy="53.5" r="1.6" fill="#8a3518" />
      </motion.g>
    </svg>
  );
}
