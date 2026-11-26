import { useEffect, useState } from "react";

export function useReducedMotion() {
	const [reduced, setReduced] = useState(
		() => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
	);
	useEffect(() => {
		const media = window.matchMedia("(prefers-reduced-motion: reduce)");
		const update = () => setReduced(media.matches);
		update();
		media.addEventListener("change", update);
		return () => media.removeEventListener("change", update);
	}, []);
	return reduced;
}

export function useInView(ref, { threshold = 0.25, rootMargin = "0px" } = {}) {
	const [inView, setInView] = useState(false);
	useEffect(() => {
		const node = ref.current;
		if (!node) return undefined;
		const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), {
			threshold,
			rootMargin,
		});
		observer.observe(node);
		return () => observer.disconnect();
	}, [ref, threshold, rootMargin]);
	return inView;
}

export const NAV_OFFSET = 84;

export function scrollToSection(id, reducedMotion) {
	const section = document.getElementById(id);
	if (!section) return;
	const top = id === "top" ? 0 : section.getBoundingClientRect().top + window.scrollY - NAV_OFFSET;
	window.scrollTo({ top, behavior: reducedMotion ? "auto" : "smooth" });
	window.history.replaceState(null, "", id === "top" ? window.location.pathname : `#${id}`);
}

export function useActiveSection(ids) {
	const [active, setActive] = useState(null);
	useEffect(() => {
		let frame = 0;
		const evaluate = () => {
			frame = 0;
			const probe = NAV_OFFSET + window.innerHeight * 0.3;
			const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
			let current = null;
			for (const id of ids) {
				const node = document.getElementById(id);
				if (node && node.getBoundingClientRect().top <= probe) current = id;
			}
			if (atBottom) current = ids[ids.length - 1];
			setActive(current);
		};
		const onScroll = () => {
			if (!frame) frame = requestAnimationFrame(evaluate);
		};
		evaluate();
		window.addEventListener("scroll", onScroll, { passive: true });
		window.addEventListener("resize", onScroll);
		return () => {
			window.removeEventListener("scroll", onScroll);
			window.removeEventListener("resize", onScroll);
			if (frame) cancelAnimationFrame(frame);
		};
	}, [ids]);
	return active;
}

export async function copyText(text) {
	try {
		await navigator.clipboard.writeText(text);
		return true;
	} catch {
		const area = document.createElement("textarea");
		area.value = text;
		area.setAttribute("readonly", "");
		area.style.position = "fixed";
		area.style.opacity = "0";
		document.body.appendChild(area);
		area.select();
		const ok = document.execCommand("copy");
		document.body.removeChild(area);
		return ok;
	}
}
