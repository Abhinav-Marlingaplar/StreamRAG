import { demoVideoUrl } from "./content";
import { SectionHeading } from "./ui";

const chapters = [
	{ index: "01", title: "Streaming incident events", body: "Publish a lifecycle from the Event Simulator and watch it land." },
	{ index: "02", title: "Versions forming in real time", body: "Each update opens a new validity window on the timeline." },
	{ index: "03", title: "Asking as-of questions", body: "Compare what is true now with what was true at 10:35." },
	{ index: "04", title: "Citations and diagnostics", body: "Inspect TAR scores, gating tier, and cited versions." },
];

const isVideoFile = (url) => /\.(mp4|webm|ogg|mov)(\?|#|$)/i.test(url);

export default function DemoSection() {
	return (
		<section
			className="lp-section lp-demo"
			id="demo"
		>
			<div className="lp-container">
				<SectionHeading
					align="center"
					eyebrow="Product demo"
					lead="A complete walkthrough of the running product — ingestion, the temporal timeline, and evidence-backed answers."
					title="See StreamRAG reason through time."
				/>

				<div
					className="lp-video"
					data-reveal
				>
					<div className="lp-video-glow" />
					<div className="lp-video-frame">
						{demoVideoUrl ? (
							isVideoFile(demoVideoUrl) ? (
								<video
									controls
									playsInline
									preload="metadata"
									src={demoVideoUrl}
								/>
							) : (
								<iframe
									allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
									allowFullScreen
									loading="lazy"
									src={demoVideoUrl}
									title="StreamRAG demo video"
								/>
							)
						) : (
							<div className="lp-video-placeholder">
								<div className="lp-video-grid" />
								<div className="lp-video-wave">
									{Array.from({ length: 48 }).map((_, index) => (
										<i
											key={index}
											style={{
												height: `${18 + Math.round(Math.abs(Math.sin(index * 0.55)) * 62)}%`,
												animationDelay: `${(index * 0.06).toFixed(2)}s`,
											}}
										/>
									))}
								</div>
								<div className="lp-video-center">
									<span className="lp-video-play">
										<svg
											aria-hidden
											height="22"
											viewBox="0 0 24 24"
											width="22"
										>
											<path
												d="M8 5.5v13l10.5-6.5z"
												fill="currentColor"
											/>
										</svg>
									</span>
									<p className="lp-video-title">Walkthrough premiering soon</p>
									<p className="lp-video-sub">Recorded end to end on the local-first stack</p>
								</div>
								<div className="lp-video-bar">
									<span className="lp-mono">00:00</span>
									<span className="lp-video-track">
										{chapters.map((chapter) => (
											<i key={chapter.index} />
										))}
									</span>
									<span className="lp-mono">StreamRAG</span>
								</div>
							</div>
						)}
					</div>
				</div>

				<ol
					className="lp-chapters"
					data-reveal-group
				>
					{chapters.map((chapter) => (
						<li
							data-reveal-item
							key={chapter.index}
						>
							<span className="lp-chapter-index">{chapter.index}</span>
							<p className="lp-chapter-title">{chapter.title}</p>
							<p className="lp-chapter-body">{chapter.body}</p>
						</li>
					))}
				</ol>
			</div>
		</section>
	);
}
