import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import EditorialPage from "../../pages/EditorialPage";
import "../../styles/knowledge-updates.css";

export default function KnowledgeUpdates() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash !== "#other-knowledge" && hash !== "#knowledge-updates") return;
    const frame = requestAnimationFrame(() => {
      document
        .getElementById("other-knowledge")
        ?.scrollIntoView({ block: "start" });
    });
    return () => cancelAnimationFrame(frame);
  }, [pathname, hash]);
  return (
    <section
      id="other-knowledge"
      className="knowledge-other-section"
      aria-label="其他科普知识"
    >
      <EditorialPage kind="knowledge" embedded />
    </section>
  );
}
