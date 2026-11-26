import { appUrl, githubUrl, navSections } from "./content";
import { scrollToSection } from "./hooks";
import { Icon, Logo } from "./ui";

export default function Footer({ reducedMotion }) {
	const year = new Date().getFullYear();
	return (
		<footer className="lp-footer">
			<div className="lp-container">
				<div className="lp-footer-cta">
					<p>Know what happened. Know what changed. Know what is true now.</p>
					<div className="lp-footer-cta-actions">
						<a
							className="lp-btn lp-btn-primary"
							href={githubUrl}
							rel="noreferrer"
							target="_blank"
						>
							<Icon name="github" />
							Star on GitHub
						</a>
						<a
							className="lp-btn lp-btn-ghost"
							href={appUrl}
						>
							Open the app
						</a>
					</div>
				</div>

				<div className="lp-footer-grid">
					<div className="lp-footer-brand">
						<a
							className="lp-brand"
							href="#top"
							onClick={(event) => {
								event.preventDefault();
								scrollToSection("top", reducedMotion);
							}}
						>
							<Logo />
							<span>StreamRAG</span>
						</a>
						<p>
							Real-time, temporal retrieval-augmented generation for incident operations. Streams events through
							Kafka, versions knowledge in PostgreSQL + pgvector, and answers with cited evidence.
						</p>
					</div>
					<nav
						aria-label="Footer"
						className="lp-footer-col"
					>
						<p>Explore</p>
						{navSections.map((item) => (
							<a
								href={`#${item.id}`}
								key={item.id}
								onClick={(event) => {
									event.preventDefault();
									scrollToSection(item.id, reducedMotion);
								}}
							>
								{item.label}
							</a>
						))}
					</nav>
					<div className="lp-footer-col">
						<p>Project</p>
						<a
							href={githubUrl}
							rel="noreferrer"
							target="_blank"
						>
							GitHub repository
							<Icon
								name="arrow-up-right"
								size={13}
							/>
						</a>
						<a href={appUrl}>Open the app</a>
						<a
							href={`${githubUrl}#readme`}
							rel="noreferrer"
							target="_blank"
						>
							README
							<Icon
								name="arrow-up-right"
								size={13}
							/>
						</a>
					</div>
				</div>

				<div className="lp-footer-base">
					<p>© {year} StreamRAG</p>
					<p className="lp-mono">Kafka · PostgreSQL · pgvector · FastAPI · React</p>
				</div>
			</div>
		</footer>
	);
}
