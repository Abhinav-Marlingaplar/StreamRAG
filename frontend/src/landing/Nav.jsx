import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { appUrl, githubUrl, navSections } from "./content";
import { scrollToSection } from "./hooks";
import { Icon, Logo } from "./ui";

export default function Nav({ activeSection, reducedMotion }) {
	const [scrolled, setScrolled] = useState(false);
	const [menuOpen, setMenuOpen] = useState(false);
	const [indicator, setIndicator] = useState({ left: 0, width: 0, visible: false });
	const linkRefs = useRef({});

	useEffect(() => {
		const onScroll = () => setScrolled(window.scrollY > 12);
		onScroll();
		window.addEventListener("scroll", onScroll, { passive: true });
		return () => window.removeEventListener("scroll", onScroll);
	}, []);

	useLayoutEffect(() => {
		const measure = () => {
			const node = activeSection ? linkRefs.current[activeSection] : null;
			if (!node) {
				setIndicator((prev) => ({ ...prev, visible: false }));
				return;
			}
			setIndicator({ left: node.offsetLeft, width: node.offsetWidth, visible: true });
		};
		measure();
		window.addEventListener("resize", measure);
		return () => window.removeEventListener("resize", measure);
	}, [activeSection]);

	useEffect(() => {
		if (!menuOpen) return undefined;
		const onKey = (event) => event.key === "Escape" && setMenuOpen(false);
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [menuOpen]);

	const go = (id) => {
		setMenuOpen(false);
		scrollToSection(id, reducedMotion);
	};

	return (
		<header className={`lp-nav ${scrolled ? "is-scrolled" : ""} ${menuOpen ? "is-open" : ""}`}>
			<div className="lp-nav-inner">
				<a
					className="lp-brand"
					href="#top"
					onClick={(event) => {
						event.preventDefault();
						go("top");
					}}
				>
					<Logo />
					<span>StreamRAG</span>
				</a>

				<nav
					aria-label="Primary"
					className="lp-nav-links"
				>
					<span
						aria-hidden
						className="lp-nav-indicator"
						style={{
							transform: `translateX(${indicator.left}px)`,
							width: indicator.width,
							opacity: indicator.visible ? 1 : 0,
						}}
					/>
					{navSections.map((item) => (
						<a
							aria-current={activeSection === item.id ? "true" : undefined}
							className={`lp-nav-link ${activeSection === item.id ? "is-active" : ""}`}
							href={`#${item.id}`}
							key={item.id}
							onClick={(event) => {
								event.preventDefault();
								go(item.id);
							}}
							ref={(node) => {
								linkRefs.current[item.id] = node;
							}}
						>
							{item.label}
						</a>
					))}
				</nav>

				<div className="lp-nav-actions">
					<a
						aria-label="StreamRAG on GitHub"
						className="lp-icon-link"
						href={githubUrl}
						rel="noreferrer"
						target="_blank"
					>
						<Icon
							name="github"
							size={18}
						/>
					</a>
					<a
						className="lp-btn lp-btn-primary lp-btn-sm"
						href={appUrl}
					>
						Open app
					</a>
				</div>

				<button
					aria-expanded={menuOpen}
					aria-label={menuOpen ? "Close menu" : "Open menu"}
					className="lp-nav-toggle"
					onClick={() => setMenuOpen((open) => !open)}
					type="button"
				>
					<Icon
						name={menuOpen ? "close" : "menu"}
						size={20}
					/>
				</button>
			</div>

			<div className="lp-nav-sheet">
				{navSections.map((item) => (
					<a
						className={`lp-nav-sheet-link ${activeSection === item.id ? "is-active" : ""}`}
						href={`#${item.id}`}
						key={item.id}
						onClick={(event) => {
							event.preventDefault();
							go(item.id);
						}}
						tabIndex={menuOpen ? 0 : -1}
					>
						{item.label}
						<Icon name="arrow-right" />
					</a>
				))}
				<div className="lp-nav-sheet-actions">
					<a
						className="lp-btn lp-btn-ghost"
						href={githubUrl}
						rel="noreferrer"
						tabIndex={menuOpen ? 0 : -1}
						target="_blank"
					>
						<Icon name="github" />
						GitHub
					</a>
					<a
						className="lp-btn lp-btn-primary"
						href={appUrl}
						tabIndex={menuOpen ? 0 : -1}
					>
						Open app
					</a>
				</div>
			</div>
		</header>
	);
}
