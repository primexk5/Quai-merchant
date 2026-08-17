"use client";

import { useEffect, useState } from "react";

export function DocsSideNav({ sections }: { sections: { id: string; label: string }[] }) {
  const [active, setActive] = useState<string>(sections[0]?.id ?? "");

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-96px 0px -55% 0px", threshold: 0 },
    );

    sections.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [sections]);

  return (
    <nav className="space-y-1">
      {sections.map((item) => {
        const isActive = active === item.id;
        return (
          <a
            key={item.id}
            href={`#${item.id}`}
            className={`block rounded-lg px-3 py-2 text-sm transition ${
              isActive
                ? "bg-[#38bdf8]/[0.08] text-white"
                : "text-[#8b93a7] hover:bg-white/[0.05] hover:text-white"
            }`}
          >
            {item.label}
          </a>
        );
      })}
    </nav>
  );
}