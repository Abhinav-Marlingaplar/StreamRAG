const base = {
	fill: "none",
	stroke: "currentColor",
	strokeWidth: 1.6,
	strokeLinecap: "round",
	strokeLinejoin: "round",
	"aria-hidden": true,
};

const paths = {
	overview: ["M4 13.5V20h5.5v-6.5z", "M14.5 4V20H20V4z", "M9.5 9.5V20H14V9.5z"],
	stream: ["M3 7h13", "M3 12h18", "M3 17h9", "M19 5l2 2-2 2"],
	intelligence: ["M12 3.5l1.8 5.2 5.2 1.8-5.2 1.8L12 17.5l-1.8-5.2L5 10.5l5.2-1.8z", "M18.5 16.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z"],
	simulator: ["M12 3v4", "M12 17v4", "M3 12h4", "M17 12h4", "M12 8.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7z"],
	search: ["M10.5 4a6.5 6.5 0 1 1 0 13 6.5 6.5 0 0 1 0-13z", "M15.5 15.5 20 20"],
	close: ["M6 6l12 12", "M18 6 6 18"],
	menu: ["M4 8h16", "M4 16h16"],
	copy: ["M8.5 8.5h9a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2z", "M15.5 8.5V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7.5a2 2 0 0 0 2 2h2.5"],
	check: ["M5 12.5l4.5 4.5L19 7.5"],
	play: ["M8 5.5v13l10.5-6.5z"],
	stop: ["M7 7h10v10H7z"],
	pause: ["M8 5v14", "M16 5v14"],
	send: ["M4 12l16-8-6 17-3-7z"],
	logout: ["M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4", "M10 8l-4 4 4 4", "M6 12h10"],
	external: ["M7 17 17 7", "M8 7h9v9"],
	arrow: ["M5 12h14", "M13 6l6 6-6 6"],
	refresh: ["M4 12a8 8 0 0 1 14-5.3L20 9", "M20 4v5h-5", "M20 12a8 8 0 0 1-14 5.3L4 15", "M4 20v-5h5"],
	plus: ["M12 5v14", "M5 12h14"],
	clock: ["M12 3.5a8.5 8.5 0 1 1 0 17 8.5 8.5 0 0 1 0-17z", "M12 7.5V12l3 2"],
	dice: ["M5 5h14v14H5z", "M9 9h.01", "M15 9h.01", "M12 12h.01", "M9 15h.01", "M15 15h.01"],
};

export function Icon({ name, size = 16 }) {
	const filled = name === "play";
	return (
		<svg
			{...base}
			fill={filled ? "currentColor" : "none"}
			height={size}
			stroke={filled ? "none" : "currentColor"}
			viewBox="0 0 24 24"
			width={size}
		>
			{(paths[name] || []).map((d) => (
				<path
					d={d}
					key={d}
				/>
			))}
		</svg>
	);
}
