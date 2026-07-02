import { useEffect, useRef, useState, MutableRefObject } from 'react';

interface ScrollAnimationOptions {
  threshold?: number;
  rootMargin?: string;
  once?: boolean;
}

interface ScrollAnimationReturn<T extends HTMLElement = HTMLElement> {
  ref: MutableRefObject<T | null>;
  isVisible: boolean;
  hasAnimated: boolean;
}

interface StaggerAnimationReturn<T extends HTMLElement = HTMLElement> {
  containerRef: MutableRefObject<T | null>;
  isVisible: boolean;
}

/**
 * Custom hook for scroll-triggered animations using IntersectionObserver
 */
export function useScrollAnimation<T extends HTMLElement = HTMLElement>(options: ScrollAnimationOptions = {}): ScrollAnimationReturn<T> {
  const ref = useRef<T | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [hasAnimated, setHasAnimated] = useState(false);

  const {
    threshold = 0.2,
    rootMargin = '0px 0px -100px 0px',
    once = true
  } = options;

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          if (once) {
            setHasAnimated(true);
          }
        } else if (!once) {
          setIsVisible(false);
        }
      },
      { threshold, rootMargin }
    );

    observer.observe(element);

    return () => {
      observer.unobserve(element);
    };
  }, [threshold, rootMargin, once]);

  return { ref, isVisible, hasAnimated };
}

/**
 * Hook for animating multiple children with staggered delays
 */
export function useStaggerAnimation<T extends HTMLElement = HTMLElement>(options: ScrollAnimationOptions = {}): StaggerAnimationReturn<T> {
  const containerRef = useRef<T | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  const {
    threshold = 0.1,
    rootMargin = '0px 0px -50px 0px'
  } = options;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold, rootMargin }
    );

    observer.observe(container);

    return () => {
      observer.unobserve(container);
    };
  }, [threshold, rootMargin]);

  return { containerRef, isVisible };
}

/**
 * Hook for counting up animation (for stats)
 */
export function useCountUp(end: number, duration: number = 2000, start: boolean = false): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!start) return;

    let startTime: number | null = null;
    let animationFrame: number;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);

      // Easing function (ease-out)
      const easeOut = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(easeOut * end));

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };

    animationFrame = requestAnimationFrame(animate);

    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
    };
  }, [end, duration, start]);

  return count;
}

/**
 * Hook for parallax scroll effect
 */
export function useParallax(speed: number = 0.5, maxScroll: number | null = null): number {
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      const max = maxScroll || window.innerHeight * 1.5;

      if (scrollY <= max) {
        requestAnimationFrame(() => {
          setOffset(scrollY * speed);
        });
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [speed, maxScroll]);

  return offset;
}

export default useScrollAnimation;
