import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * Custom hook for scroll-triggered animations using IntersectionObserver
 * @param {Object} options - Configuration options
 * @param {number} options.threshold - Visibility threshold (0-1), default 0.2
 * @param {string} options.rootMargin - Root margin for observer, default '0px 0px -100px 0px'
 * @param {boolean} options.once - Only animate once, default true
 * @returns {Object} - { ref, isVisible, hasAnimated }
 */
export function useScrollAnimation(options = {}) {
  const ref = useRef(null);
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
 * @param {Object} options - Configuration options
 * @returns {Object} - { containerRef, isVisible }
 */
export function useStaggerAnimation(options = {}) {
  const containerRef = useRef(null);
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
 * @param {number} end - Target number
 * @param {number} duration - Animation duration in ms
 * @param {boolean} start - Whether to start the animation
 * @returns {number} - Current animated value
 */
export function useCountUp(end, duration = 2000, start = false) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!start) return;

    let startTime = null;
    let animationFrame;

    const animate = (timestamp) => {
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
 * @param {number} speed - Parallax speed multiplier (0-1)
 * @param {number} maxScroll - Maximum scroll position to track
 * @returns {number} - Current offset value
 */
export function useParallax(speed = 0.5, maxScroll = null) {
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
