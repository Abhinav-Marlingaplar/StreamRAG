import logoUrl from "../assets/streamrag-logo.svg";

const base = {
	fill: "none",
	stroke: "currentColor",
	strokeWidth: 1.6,
	strokeLinecap: "round",
	strokeLinejoin: "round",
	"aria-hidden": true,
};

export function Icon({ name, size = 16 }) {
	const props = { ...base, width: size, height: size, viewBox: "0 0 24 24" };
	switch (name) {
		case "arrow-right":
			return (
				<svg {...props}>
					<path d="M5 12h14M13 6l6 6-6 6" />
				</svg>
			);
		case "arrow-up-right":
			return (
				<svg {...props}>
					<path d="M7 17 17 7M8 7h9v9" />
				</svg>
			);
		case "play":
			return (
				<svg {...props}>
					<path
						d="M8 5.5v13l10.5-6.5z"
						fill="currentColor"
						stroke="none"
					/>
				</svg>
			);
		case "pause":
			return (
				<svg {...props}>
					<path d="M8 5v14M16 5v14" strokeWidth="2.4" />
				</svg>
			);
		case "prev":
			return (
				<svg {...props}>
					<path d="M15 6l-6 6 6 6" />
				</svg>
			);
		case "next":
			return (
				<svg {...props}>
					<path d="M9 6l6 6-6 6" />
				</svg>
			);
		case "replay":
			return (
				<svg {...props}>
					<path d="M4 12a8 8 0 1 0 2.4-5.7" />
					<path d="M4 4v4.5h4.5" />
				</svg>
			);
		case "copy":
			return (
				<svg {...props}>
					<rect x="8.5" y="8.5" width="11" height="11" rx="2.5" />
					<path d="M15.5 8.5V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7.5a2 2 0 0 0 2 2h2.5" />
				</svg>
			);
		case "check":
			return (
				<svg {...props}>
					<path d="m5 12.5 4.5 4.5L19 7.5" />
				</svg>
			);
		case "github":
			return (
				<svg
					width={size}
					height={size}
					viewBox="0 0 24 24"
					aria-hidden
				>
					<path
						fill="currentColor"
						d="M12 2C6.48 2 2 6.58 2 12.25c0 4.53 2.87 8.37 6.84 9.73.5.09.68-.22.68-.49l-.01-1.9c-2.78.62-3.37-1.21-3.37-1.21-.46-1.18-1.11-1.5-1.11-1.5-.91-.64.07-.62.07-.62 1 .07 1.53 1.06 1.53 1.06.9 1.57 2.35 1.11 2.92.85.09-.66.35-1.11.64-1.37-2.22-.26-4.56-1.14-4.56-5.07 0-1.12.39-2.04 1.03-2.76-.1-.26-.45-1.3.1-2.72 0 0 .84-.28 2.75 1.05A9.36 9.36 0 0 1 12 6.94c.85 0 1.7.12 2.5.34 1.9-1.33 2.74-1.05 2.74-1.05.55 1.42.2 2.46.1 2.72.64.72 1.03 1.64 1.03 2.76 0 3.94-2.34 4.8-4.57 5.06.36.32.68.94.68 1.9l-.01 2.82c0 .27.18.59.69.49A10.25 10.25 0 0 0 22 12.25C22 6.58 17.52 2 12 2z"
					/>
				</svg>
			);
		case "menu":
			return (
				<svg {...props}>
					<path d="M4 8h16M4 16h16" />
				</svg>
			);
		case "close":
			return (
				<svg {...props}>
					<path d="M6 6l12 12M18 6 6 18" />
				</svg>
			);
		default:
			return null;
	}
}

export function Logo({ size = 34 }) {
	return (
		<img
			alt=""
			className="lp-logo"
			height={size}
			src={logoUrl}
			width={size}
		/>
	);
}

export function SectionHeading({ eyebrow, title, lead, align = "left", tone = "default" }) {
	return (
		<header
			className={`lp-heading lp-heading-${align}`}
			data-reveal-group
		>
			{eyebrow && (
				<p
					className={`lp-eyebrow lp-eyebrow-${tone}`}
					data-reveal-item
				>
					{eyebrow}
				</p>
			)}
			<h2 data-reveal-item>{title}</h2>
			{lead && (
				<p
					className="lp-lead"
					data-reveal-item
				>
					{lead}
				</p>
			)}
		</header>
	);
}
