import { motion } from "framer-motion";

/**
 * NarrativeGhost — atmospheric "Light Leak" for the empty narrative space.
 * A blurred emerald radial blob, slightly off-axis, that breathes at ~10s.
 * Renders inside the masked narrative <main>, fades out when messages arrive.
 */
const NarrativeGhost = () => {
  return (
    <motion.div
      key="narrative-ghost"
      aria-hidden
      className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 1, ease: [0.4, 0, 0.2, 1] }}
    >
      <motion.div
        className="absolute"
        style={{
          // Off-axis, large blurred radial — emerald promise of safety
          width: "140%",
          height: "140%",
          left: "-15%",
          top: "-25%",
          background:
            "radial-gradient(closest-side, rgba(16,185,129,0.075), rgba(16,185,129,0.035) 40%, rgba(16,185,129,0) 70%)",
          filter: "blur(40px)",
        }}
        animate={{ scale: [1, 1.1, 1] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
      />
    </motion.div>
  );
};

export default NarrativeGhost;
