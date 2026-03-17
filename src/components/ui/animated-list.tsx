"use client";

import { motion } from "framer-motion";

interface AnimatedListProps {
  children: React.ReactNode[];
  className?: string;
  staggerDelay?: number;
}

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.06,
      duration: 0.35,
      ease: [0.25, 0.1, 0.25, 1],
    },
  }),
};

export function AnimatedList({
  children,
  className,
  staggerDelay,
}: AnimatedListProps) {
  const delay = staggerDelay ?? 0.06;

  return (
    <div className={className}>
      {children.map((child, i) => (
        <motion.div
          key={i}
          custom={i}
          initial="hidden"
          animate="visible"
          variants={{
            hidden: { opacity: 0, y: 10 },
            visible: {
              opacity: 1,
              y: 0,
              transition: {
                delay: i * delay,
                duration: 0.35,
                ease: [0.25, 0.1, 0.25, 1],
              },
            },
          }}
        >
          {child}
        </motion.div>
      ))}
    </div>
  );
}

export { itemVariants };
