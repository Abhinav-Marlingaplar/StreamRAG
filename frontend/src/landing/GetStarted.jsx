import { useRef, useState } from "react";
import { appUrl, githubUrl, prerequisites, setupNote, setupSteps } from "./content";
import { copyText } from "./hooks";
import { Icon } from "./ui";

const ports = [
	{ label: "App", value: ":5173" },
	{ label: "API", value: ":8000" },
	{ label: "Kafka", value: ":9092" },
	{ label: "PostgreSQL", value: ":5432" },
];

function CopyButton({ text, label }) {
	const [copied, setCopied] = useState(false);
	const timer = useRef(0);
	return (
		<button
			aria-label={copied ? "Copied" : `Copy ${label}`}
			className={`lp-copy ${copied ? "is-copied" : ""}`}
			onClick={async () => {
				const ok = await copyText(text);
				if (!ok) return;
				setCopied(true);
				clearTimeout(timer.current);
				timer.current = setTimeout(() => setCopied(false), 1600);
			}}
			type="button"
		>
			<Icon
				name={copied ? "check" : "copy"}
				size={14}
			/>
			<span>{copied ? "Copied" : "Copy"}</span>
		</button>
	);
}

export default function GetStarted() {
	return (
		<section
			className="lp-section lp-start"
			id="get-started"
		>
			<div className="lp-container lp-start-grid">
				<div
					className="lp-start-intro"
					data-reveal-group
				>
					<p
						className="lp-eyebrow"
						data-reveal-item
					>
						Get started
					</p>
					<h2 data-reveal-item>Run the full stack on your machine.</h2>
					<p
						className="lp-lead"
						data-reveal-item
					>
						StreamRAG is local-first: Kafka and PostgreSQL run in Docker, and the API, ingestion worker, and app run
						as local processes.
					</p>
					<div
						className="lp-start-ctas"
						data-reveal-item
					>
						<a
							className="lp-btn lp-btn-primary"
							href={githubUrl}
							rel="noreferrer"
							target="_blank"
						>
							<Icon name="github" />
							View on GitHub
						</a>
						<a
							className="lp-btn lp-btn-ghost"
							href={appUrl}
						>
							Open the app
							<Icon name="arrow-right" />
						</a>
					</div>
					<dl
						className="lp-start-facts"
						data-reveal-item
					>
						<div>
							<dt>Requires</dt>
							<dd>
								{prerequisites.map((item) => (
									<span key={item}>{item}</span>
								))}
							</dd>
						</div>
						<div>
							<dt>Ports</dt>
							<dd>
								{ports.map((port) => (
									<span key={port.label}>
										{port.label} <b>{port.value}</b>
									</span>
								))}
							</dd>
						</div>
					</dl>
				</div>

				<div
					className="lp-terminal"
					data-reveal
				>
					<div className="lp-terminal-head">
						<span className="lp-terminal-dots">
							<i />
							<i />
							<i />
						</span>
						<span className="lp-mono">StreamRAG · quick start</span>
					</div>
					<ol className="lp-steps">
						{setupSteps.map((step, index) => (
							<li
								className="lp-step"
								key={step.title}
							>
								<div className="lp-step-head">
									<span className="lp-step-index">{index + 1}</span>
									<div>
										<p className="lp-step-title">{step.title}</p>
										{step.note && <p className="lp-step-note">{step.note}</p>}
									</div>
									<CopyButton
										label={step.title}
										text={step.command}
									/>
								</div>
								<pre className="lp-step-code">
									<code>
										{step.command.split("\n").map((line, lineIndex) => (
											<span key={`${lineIndex}-${line}`}>{line}</span>
										))}
									</code>
								</pre>
							</li>
						))}
					</ol>
					<p className="lp-terminal-foot">{setupNote}</p>
				</div>
			</div>
		</section>
	);
}
