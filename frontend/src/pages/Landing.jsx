import { useEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const githubUrl = import.meta.env.VITE_GITHUB_URL || "https://github.com/your-org/streamrag";
const appUrl = import.meta.env.VITE_APP_URL || "/login";
const demoVideoUrl = import.meta.env.VITE_DEMO_VIDEO_URL || "";

const navSections = [
	{ id: "product", label: "Product" },
	{ id: "architecture", label: "Architecture" },
	{ id: "demo", label: "Demo" },
	{ id: "get-started", label: "Get started" },
];

const setupCommands = [
	"docker compose -f infrastructure/docker-compose.yml up -d",
	"cd backend && pip install -r requirements.txt && alembic upgrade head",
	"cd backend && python -m app.kafka.consumer",
	"cd backend && python -m uvicorn app.main:app --host 127.0.0.1 --port 8000",
	"cd frontend && npm install && npm run dev",
];

const architectureStages = [
	{ flow: "ingestion", title: "Event source", description: "Events originate from CSV and the simulator publisher." },
	{ flow: "ingestion", title: "Kafka ingress", description: "Events are written to the operations-events topic." },
	{ flow: "ingestion", title: "Consumer processing", description: "Worker validates payloads and applies idempotency checks." },
	{ flow: "ingestion", title: "Temporal persistence", description: "Knowledge versions and raw events are stored in PostgreSQL." },
	{ flow: "ingestion", title: "Vector indexing", description: "Embeddings are generated and indexed in pgvector." },
	{ flow: "ingestion", title: "Versioned knowledge ready", description: "Temporal incident knowledge is now queryable." },
	{ flow: "retrieval", title: "Query entry", description: "A user asks a current-state or as-of temporal question." },
	{ flow: "retrieval", title: "Retrieval strategy", description: "Dynamic gating selects retrieval intensity for the query." },
	{ flow: "retrieval", title: "TAR scoring", description: "Semantic similarity and time-decay are scored together." },
	{ flow: "retrieval", title: "Evidence selection", description: "Best temporal evidence is selected for generation." },
	{ flow: "retrieval", title: "Answer with citations", description: "LLM answer is returned with evidence and temporal context." },
];

function useReducedMotion() {
	const [reduced, setReduced] = useState(false);
	useEffect(() => {
		const media = window.matchMedia("(prefers-reduced-motion: reduce)");
		const update = () => setReduced(media.matches);
		update();
		media.addEventListener("change", update);
		return () => media.removeEventListener("change", update);
	}, []);
	return reduced;
}

export default function Landing() {
	const rootRef = useRef(null);
	const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
	const [activeSection, setActiveSection] = useState("product");
	const [activeStage, setActiveStage] = useState(0);
	const [isPlaying, setIsPlaying] = useState(true);
	const [isStepMode, setIsStepMode] = useState(false);
	const [copiedCommand, setCopiedCommand] = useState("");
	const reducedMotion = useReducedMotion();
	const year = useMemo(() => new Date().getFullYear(), []);

	useEffect(() => {
		if (reducedMotion) {
			return undefined;
		}
		const ctx = gsap.context(() => {
			gsap.from(".hero-reveal", {
				y: 20,
				opacity: 0,
				duration: 0.65,
				stagger: 0.08,
				ease: "power2.out",
			});
			gsap.utils.toArray(".scroll-reveal").forEach((item) => {
				gsap.from(item, {
					y: 18,
					opacity: 0,
					duration: 0.55,
					ease: "power2.out",
					scrollTrigger: {
						trigger: item,
						start: "top 82%",
					},
				});
			});
		}, rootRef);
		return () => ctx.revert();
	}, [reducedMotion]);

	useEffect(() => {
		const observer = new IntersectionObserver(
			(entries) => {
				const visible = entries
					.filter((entry) => entry.isIntersecting)
					.sort((a, b) => b.intersectionRatio - a.intersectionRatio);
				if (visible.length > 0) {
					setActiveSection(visible[0].target.id);
				}
			},
			{ threshold: [0.35, 0.6, 0.9], rootMargin: "-80px 0px -45% 0px" }
		);

		navSections.forEach((item) => {
			const node = document.getElementById(item.id);
			if (node) observer.observe(node);
		});
		return () => observer.disconnect();
	}, []);

	useEffect(() => {
		if (reducedMotion || !isPlaying || isStepMode) {
			return undefined;
		}
		const id = setInterval(() => {
			setActiveStage((prev) => (prev + 1) % architectureStages.length);
		}, 1500);
		return () => clearInterval(id);
	}, [isPlaying, isStepMode, reducedMotion]);

	const goToSection = (id) => {
		const section = document.getElementById(id);
		if (!section) return;
		const top = section.getBoundingClientRect().top + window.scrollY - 88;
		window.scrollTo({ top, behavior: reducedMotion ? "auto" : "smooth" });
		setMobileMenuOpen(false);
	};

	const copyCommand = async (command) => {
		try {
			await navigator.clipboard.writeText(command);
			setCopiedCommand(command);
			setTimeout(() => setCopiedCommand(""), 1200);
		} catch {
			setCopiedCommand("");
		}
	};

	const activeFlow = architectureStages[activeStage].flow;

	return (
		<div
			className="landing-root"
			ref={rootRef}
		>
			<header className="landing-topbar">
				<div className="brand-lockup">
					<span className="brand-dot" />
					<div>
						<p className="brand-title">StreamRAG</p>
						<p className="brand-subtitle">Temporal Incident Intelligence</p>
					</div>
				</div>

				<button
					className="btn btn-ghost landing-mobile-toggle"
					onClick={() => setMobileMenuOpen((prev) => !prev)}
					type="button"
				>
					Menu
				</button>

				<nav className={`landing-links ${mobileMenuOpen ? "open" : ""}`}>
					{navSections.map((item) => (
						<button
							className={`landing-link ${activeSection === item.id ? "active" : ""}`}
							key={item.id}
							onClick={() => goToSection(item.id)}
							type="button"
						>
							{item.label}
						</button>
					))}
				</nav>

				<div className="row landing-actions">
					<a
						className="btn btn-ghost"
						href={githubUrl}
						rel="noreferrer"
						target="_blank"
					>
						GitHub
					</a>
					<a
						className="btn btn-primary"
						href={appUrl}
					>
						Open Application
					</a>
				</div>
			</header>

			<section
				className="landing-hero"
				id="product"
			>
				<div className="hero-copy">
					<h1 className="hero-reveal">Understand what happened. Know what is true now.</h1>
					<p className="hero-reveal">
						StreamRAG continuously ingests operational events, preserves evolving temporal knowledge, and answers
						questions with semantically and temporally relevant evidence.
					</p>
					<div className="hero-actions hero-reveal">
						<button
							className="btn btn-primary"
							onClick={() => goToSection("architecture")}
							type="button"
						>
							Explore Architecture
						</button>
						<button
							className="btn btn-ghost"
							onClick={() => goToSection("demo")}
							type="button"
						>
							Watch Demo
						</button>
					</div>
				</div>
			</section>

			<section className="understanding-layout scroll-reveal">
				<div className="understanding-heading">
					<h2>From event streams to temporal intelligence</h2>
					<p className="muted">Built for operations teams that need accurate answers across changing incident states.</p>
				</div>
				<div className="understanding-grid">
					<article className="understanding-item">
						<h3>Continuous ingestion</h3>
						<p>Operational events enter through a streaming pipeline and are processed one-by-one.</p>
					</article>
					<article className="understanding-item">
						<h3>Temporal knowledge</h3>
						<p>Incident updates are preserved across time so current and historical truths remain distinct.</p>
					</article>
					<article className="understanding-item">
						<h3>Evidence-grounded answers</h3>
						<p>Retrieval balances relevance and recency to produce cited, explainable responses.</p>
					</article>
				</div>
			</section>

			<section
				className="architecture-layout scroll-reveal"
				id="architecture"
			>
				<div className="row-between">
					<div>
						<h2>Architecture in motion</h2>
						<p className="muted">Ingestion and query flows demonstrated step-by-step.</p>
					</div>
					<div className="row">
						<button
							className="btn btn-ghost"
							onClick={() => setIsPlaying((prev) => !prev)}
							type="button"
						>
							{isPlaying ? "Pause" : "Play"}
						</button>
						<button
							className="btn btn-ghost"
							onClick={() => {
								setIsStepMode((prev) => !prev);
								setIsPlaying(false);
							}}
							type="button"
						>
							{isStepMode ? "Auto mode" : "Step mode"}
						</button>
						<button
							className="btn btn-ghost"
							onClick={() => setActiveStage((prev) => Math.max(0, prev - 1))}
							type="button"
						>
							Prev
						</button>
						<button
							className="btn btn-ghost"
							onClick={() => setActiveStage((prev) => Math.min(architectureStages.length - 1, prev + 1))}
							type="button"
						>
							Next
						</button>
						<button
							className="btn btn-ghost"
							onClick={() => {
								setActiveStage(0);
								setIsPlaying(true);
								setIsStepMode(false);
							}}
							type="button"
						>
							Replay
						</button>
					</div>
				</div>

				<div className="architecture-flow-labels">
					<span className={`chip ${activeFlow === "ingestion" ? "chip-live" : ""}`}>Flow A · continuous ingestion</span>
					<span className={`chip ${activeFlow === "retrieval" ? "chip-live" : ""}`}>Flow B · temporal intelligence</span>
				</div>

				<div className="architecture-diagram">
					{architectureStages.map((stage, index) => (
						<div
							className={`architecture-node ${index === activeStage ? "active current" : index < activeStage ? "active" : ""}`}
							key={`${stage.flow}-${stage.title}`}
						>
							<p>{stage.title}</p>
							{index < architectureStages.length - 1 && (
								<span className={`architecture-arrow ${index < activeStage ? "active" : ""}`}>→</span>
							)}
						</div>
					))}
				</div>

				<article className="architecture-stage-panel">
					<p className="caption">Stage {activeStage + 1} of {architectureStages.length}</p>
					<h3>{architectureStages[activeStage].title}</h3>
					<p>{architectureStages[activeStage].description}</p>
				</article>
			</section>

			<section
				className="video-layout scroll-reveal"
				id="demo"
			>
				<div className="understanding-heading">
					<h2>See StreamRAG in action</h2>
					<p className="muted">A full walkthrough of ingestion, temporal retrieval, and evidence-backed responses.</p>
				</div>
				{demoVideoUrl ? (
					<div className="video-frame">
						<iframe
							allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
							allowFullScreen
							src={demoVideoUrl}
							title="StreamRAG demo video"
						/>
					</div>
				) : (
					<div className="video-placeholder">
						<p>Demo video placeholder</p>
						<p className="caption">
							Set <code>VITE_DEMO_VIDEO_URL</code> to display your embedded walkthrough.
						</p>
					</div>
				)}
			</section>

			<section
				className="setup-layout scroll-reveal"
				id="get-started"
			>
				<div className="understanding-heading">
					<h2>Get started locally</h2>
					<p className="muted">Clone the repository and run the complete stack in a few steps.</p>
				</div>
				<div className="row">
					<a
						className="btn btn-primary"
						href={githubUrl}
						rel="noreferrer"
						target="_blank"
					>
						Open GitHub repository
					</a>
					<a
						className="btn btn-ghost"
						href={appUrl}
					>
						Open Application
					</a>
				</div>
				<div className="setup-list">
					{setupCommands.map((command, index) => (
						<div
							className="setup-line"
							key={command}
						>
							<div className="row-between">
								<span className="caption">Step {index + 1}</span>
								<button
									className="btn btn-ghost"
									onClick={() => copyCommand(command)}
									type="button"
								>
									{copiedCommand === command ? "Copied" : "Copy"}
								</button>
							</div>
							<code>{command}</code>
						</div>
					))}
				</div>
			</section>

			<footer className="landing-footer">
				<div>
					<p className="brand-title">StreamRAG</p>
					<p className="muted">Temporal incident intelligence for continuously evolving operations data.</p>
				</div>
				<div className="row">
					<a
						href={githubUrl}
						rel="noreferrer"
						target="_blank"
					>
						GitHub
					</a>
					<a href={appUrl}>Open Application</a>
				</div>
				<p className="caption">© {year} StreamRAG</p>
			</footer>
		</div>
	);
}
