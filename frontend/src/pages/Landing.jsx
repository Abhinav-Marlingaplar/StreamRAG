import { useEffect, useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import ArchitectureSection from "../landing/architecture/ArchitectureSection";
import { navSections } from "../landing/content";
import DemoSection from "../landing/DemoSection";
import Footer from "../landing/Footer";
import GetStarted from "../landing/GetStarted";
import Hero from "../landing/Hero";
import { NAV_OFFSET, useActiveSection, useReducedMotion } from "../landing/hooks";
import Nav from "../landing/Nav";
import ValueSection from "../landing/ValueSection";
import "../landing/landing.css";

gsap.registerPlugin(ScrollTrigger);

const sectionIds = navSections.map((item) => item.id);

export default function Landing() {
	const rootRef = useRef(null);
	const reducedMotion = useReducedMotion();
	const activeSection = useActiveSection(sectionIds);

	useLayoutEffect(() => {
		if (reducedMotion) return undefined;
		const ctx = gsap.context(() => {
			gsap.from("[data-hero]", {
				y: 22,
				opacity: 0,
				duration: 0.9,
				stagger: 0.09,
				ease: "power3.out",
				delay: 0.05,
			});

			gsap.utils.toArray("[data-reveal]").forEach((item) => {
				gsap.from(item, {
					y: 28,
					opacity: 0,
					duration: 0.9,
					ease: "power3.out",
					scrollTrigger: { trigger: item, start: "top 86%", once: true },
				});
			});

			gsap.utils.toArray("[data-reveal-group]").forEach((group) => {
				const items = group.querySelectorAll("[data-reveal-item]");
				if (!items.length) return;
				gsap.from(items, {
					y: 20,
					opacity: 0,
					duration: 0.8,
					stagger: 0.08,
					ease: "power3.out",
					scrollTrigger: { trigger: group, start: "top 85%", once: true },
				});
			});

			const archNodes = gsap.utils.toArray(".arch-svg .arch-reveal");
			if (archNodes.length) {
				gsap.from(archNodes, {
					opacity: 0,
					y: 14,
					duration: 0.6,
					stagger: 0.035,
					ease: "power2.out",
					scrollTrigger: { trigger: ".arch-svg", start: "top 80%", once: true },
				});
			}
		}, rootRef);
		return () => ctx.revert();
	}, [reducedMotion]);

	useEffect(() => {
		const id = window.location.hash.slice(1);
		if (!id) return undefined;
		const timer = setTimeout(() => {
			const node = document.getElementById(id);
			if (node) window.scrollTo({ top: node.getBoundingClientRect().top + window.scrollY - NAV_OFFSET });
		}, 60);
		return () => clearTimeout(timer);
	}, []);

	return (
		<div
			className="lp"
			ref={rootRef}
		>
			<div
				aria-hidden
				className="lp-ambient"
			>
				<span className="lp-ambient-a" />
				<span className="lp-ambient-b" />
				<span className="lp-ambient-c" />
			</div>
			<Nav
				activeSection={activeSection}
				reducedMotion={reducedMotion}
			/>
			<main>
				<Hero reducedMotion={reducedMotion} />
				<ValueSection />
				<ArchitectureSection reducedMotion={reducedMotion} />
				<DemoSection />
				<GetStarted />
			</main>
			<Footer reducedMotion={reducedMotion} />
		</div>
	);
}
