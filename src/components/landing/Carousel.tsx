// A DOM / Framer-Motion carousel adapted from React Bits (NOT WebGL), tuned to
// the black-space + ivory monochrome identity. It is the only motion-heavy piece
// on the landing page besides the single FloatingLines WebGL field. (TASK6 §9.4)
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  motion,
  useMotionValue,
  useTransform,
  type PanInfo,
  type Transition,
} from "motion/react";
import "./Carousel.css";

export type CarouselItem = {
  id: number;
  icon: ReactNode;
  title: string;
  description: string;
};

type CarouselProps = {
  items: CarouselItem[];
  baseWidth?: number;
  autoplay?: boolean;
  autoplayDelay?: number;
  pauseOnHover?: boolean;
  loop?: boolean;
  round?: boolean;
};

const GAP = 16;
const DRAG_BUFFER = 0;
const VELOCITY_THRESHOLD = 500;
const SPRING: Transition = { type: "spring", stiffness: 300, damping: 30 };

export default function Carousel({
  items,
  baseWidth = 420,
  autoplay = false,
  autoplayDelay = 4200,
  pauseOnHover = true,
  loop = true,
  round = false,
}: CarouselProps) {
  const containerPadding = 16;
  const itemWidth = baseWidth - containerPadding * 2;
  const trackItemOffset = itemWidth + GAP;

  // When looping, append a clone of the first item so the wrap is seamless.
  const carouselItems = loop ? [...items, items[0]] : items;
  const [currentIndex, setCurrentIndex] = useState(0);
  const x = useMotionValue(0);
  const [isHovered, setIsHovered] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!pauseOnHover || !containerRef.current) return;
    const node = containerRef.current;
    const enter = () => setIsHovered(true);
    const leave = () => setIsHovered(false);
    node.addEventListener("mouseenter", enter);
    node.addEventListener("mouseleave", leave);
    return () => {
      node.removeEventListener("mouseenter", enter);
      node.removeEventListener("mouseleave", leave);
    };
  }, [pauseOnHover]);

  useEffect(() => {
    if (!autoplay || (pauseOnHover && isHovered)) return;
    const timer = window.setInterval(() => {
      setCurrentIndex((prev) => {
        if (prev === items.length - 1 && loop) return prev + 1;
        if (prev === carouselItems.length - 1) return loop ? 0 : prev;
        return prev + 1;
      });
    }, autoplayDelay);
    return () => window.clearInterval(timer);
  }, [autoplay, autoplayDelay, isHovered, loop, pauseOnHover, items.length, carouselItems.length]);

  const transition = isResetting ? { duration: 0 } : SPRING;

  const handleAnimationComplete = () => {
    if (loop && currentIndex === carouselItems.length - 1) {
      setIsResetting(true);
      x.set(0);
      setCurrentIndex(0);
      window.setTimeout(() => setIsResetting(false), 50);
    }
  };

  const handleDragEnd = (_event: unknown, info: PanInfo) => {
    const offset = info.offset.x;
    const velocity = info.velocity.x;
    if (offset < -DRAG_BUFFER || velocity < -VELOCITY_THRESHOLD) {
      if (loop && currentIndex === items.length - 1) {
        setCurrentIndex(currentIndex + 1);
      } else {
        setCurrentIndex((prev) => Math.min(prev + 1, carouselItems.length - 1));
      }
    } else if (offset > DRAG_BUFFER || velocity > VELOCITY_THRESHOLD) {
      if (loop && currentIndex === 0) {
        setCurrentIndex(items.length - 1);
      } else {
        setCurrentIndex((prev) => Math.max(prev - 1, 0));
      }
    }
  };

  const dragProps = loop
    ? {}
    : { dragConstraints: { left: -trackItemOffset * (carouselItems.length - 1), right: 0 } };

  return (
    <div
      ref={containerRef}
      className={`feature-carousel ${round ? "is-round" : ""}`}
      style={{ width: `${baseWidth}px` }}
    >
      <motion.div
        className="feature-carousel-track"
        drag="x"
        {...dragProps}
        style={{
          width: itemWidth,
          gap: `${GAP}px`,
          perspective: 1000,
          perspectiveOrigin: `${currentIndex * trackItemOffset + itemWidth / 2}px 50%`,
          x,
        }}
        onDragEnd={handleDragEnd}
        animate={{ x: -(currentIndex * trackItemOffset) }}
        transition={transition}
        onAnimationComplete={handleAnimationComplete}
      >
        {carouselItems.map((item, index) => {
          const range = [
            -(index + 1) * trackItemOffset,
            -index * trackItemOffset,
            -(index - 1) * trackItemOffset,
          ];
          // eslint-disable-next-line react-hooks/rules-of-hooks -- item count is stable
          const rotateY = useTransform(x, range, [54, 0, -54], { clamp: false });
          return (
            <motion.div
              key={index}
              className="feature-carousel-item"
              style={{ width: itemWidth, rotateY }}
              transition={transition}
            >
              <span className="feature-carousel-icon" aria-hidden="true">
                {item.icon}
              </span>
              <div className="feature-carousel-copy">
                <h4>{item.title}</h4>
                <p>{item.description}</p>
              </div>
            </motion.div>
          );
        })}
      </motion.div>

      <div className="feature-carousel-dots">
        {items.map((_, index) => (
          <button
            key={index}
            type="button"
            aria-label={`Show feature ${index + 1}`}
            aria-current={currentIndex % items.length === index}
            className={`feature-carousel-dot ${currentIndex % items.length === index ? "is-active" : ""}`}
            onClick={() => setCurrentIndex(index)}
          />
        ))}
      </div>
    </div>
  );
}
