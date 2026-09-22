import { useEffect, useRef, useState } from "react";
import lottie from "lottie-web";

export default function PublicLottie({ path, className = "", loop = true }) {
  const containerRef = useRef(null);
  const [animationData, setAnimationData] = useState(null);

  useEffect(() => {
    let cancelled = false;

    fetch(path)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setAnimationData(data);
      })
      .catch(() => {
        if (!cancelled) setAnimationData(null);
      });

    return () => {
      cancelled = true;
    };
  }, [path]);

  useEffect(() => {
    if (!animationData || !containerRef.current) return undefined;

    const animation = lottie.loadAnimation({
      container: containerRef.current,
      renderer: "svg",
      loop,
      autoplay: true,
      animationData,
    });

    return () => {
      animation.destroy();
    };
  }, [animationData, loop]);

  if (!animationData) {
    return <span className={`public-lottie-fallback ${className}`} />;
  }

  return <span ref={containerRef} className={className} />;
}
