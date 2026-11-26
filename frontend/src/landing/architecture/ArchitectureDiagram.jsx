import { ANSWER, STAGE, STORE, VIEW, edges, nodes, stages } from "./stages";

const glyphs = {
	source: ["M7 3.5h7l4 4V20.5H7z", "M14 3.5v4h4", "M10 12.5h5", "M10 16h5"],
	kafka: ["M3.5 7h17", "M3.5 12h17", "M3.5 17h17", "M8 5v4", "M14 10v4", "M10 15v4"],
	consumer: ["M3 12h4l2.5-5.5 4.5 11 2.5-5.5H21"],
	versioning: ["M12 7.5V12l3 2", "M12 3.5a8.5 8.5 0 1 1 0 17 8.5 8.5 0 0 1 0-17z"],
	embed: ["M5 19.5v-8", "M9.5 19.5V5", "M14 19.5v-11", "M18.5 19.5v-6"],
	query: ["M4 5h16v11H10l-6 4.5z", "M8 9.5h8", "M8 12.5h5"],
	retrieve: ["M10.5 4a6.5 6.5 0 1 1 0 13 6.5 6.5 0 0 1 0-13z", "M15.5 15.5 20 20"],
	gate: ["M4 5h16l-6 7.5V18l-4 2v-7.5z"],
	tar: ["M4 20h16", "M7 16.5V12", "M12 16.5V6.5", "M17 16.5V9.5"],
	evidence: ["M8 3.5h10v14H8z", "M5 7v13.5h10", "M11 8h4", "M11 11h4"],
	llm: ["M12 3l2 6.2 6.2 2-6.2 2L12 19.5l-2-6.3-6.2-2 6.2-2z"],
};

const kSteps = { source: "A1", kafka: "A2", consumer: "A3", versioning: "A4", embed: "A5" };

const nodeStageIndex = stages.reduce((acc, stage, index) => {
	acc[stage.node] = index;
	return acc;
}, {});

const edgeStageIndex = stages.reduce((acc, stage, index) => {
	stage.edges.forEach((edge) => {
		acc[edge] = index;
	});
	return acc;
}, {});

// Version windows for INC-1024 in minutes after 10:00 (see simulator/demo_scenario.json).
const versions = [
	{ v: 1, start: 10, end: 30, status: "investigating" },
	{ v: 2, start: 30, end: 45, status: "root_cause_identified" },
	{ v: 3, start: 45, end: 60, status: "mitigated" },
	{ v: 4, start: 60, end: null, status: "resolved" },
];
const OPEN_END = 80;
const AS_OF = 35;
const tx = (minute) => 340 + (minute - 10) * 11;
const vecHeights = [
	[6, 11, 4, 9, 12, 7],
	[10, 5, 12, 6, 8, 4],
	[4, 9, 7, 12, 5, 10],
	[12, 6, 9, 4, 11, 7],
];

function stateFor(index, stage) {
	if (index === stage) return "is-active";
	if (index < stage) return "is-done";
	return "";
}

function NodeDecor({ id, node }) {
	const right = node.x + node.w - 16;
	const top = node.y + 18;
	if (node.kind === "transport") {
		return (
			<g className="arch-partitions">
				{[0, 1, 2].map((row) => (
					<g key={row}>
						{[0, 1, 2, 3, 4].map((cell) => (
							<rect
								height="4"
								key={cell}
								rx="1"
								style={{ animationDelay: `${(cell * 0.12 + row * 0.2).toFixed(2)}s` }}
								width="8"
								x={right - 56 + cell * 12}
								y={top + row * 8}
							/>
						))}
					</g>
				))}
			</g>
		);
	}
	if (id === "gate") {
		return (
			<g className="arch-tiers">
				{["1", "3", "5"].map((k, index) => (
					<g key={k}>
						<rect
							height="16"
							rx="4"
							width="18"
							x={right - 62 + index * 22}
							y={top - 2}
						/>
						<text
							x={right - 53 + index * 22}
							y={top + 9.5}
						>
							{k}
						</text>
					</g>
				))}
			</g>
		);
	}
	if (id === "tar") {
		return (
			<g className="arch-bars">
				{[18, 13, 9, 6].map((height, index) => (
					<rect
						height={height}
						key={height}
						rx="1.5"
						width="6"
						x={right - 34 + index * 9}
						y={top + 18 - height}
					/>
				))}
			</g>
		);
	}
	if (kSteps[id]) {
		return (
			<text
				className="arch-step"
				textAnchor="end"
				x={right}
				y={top + 10}
			>
				{kSteps[id]}
			</text>
		);
	}
	return null;
}

function Node({ id, stage, onSelect }) {
	const node = nodes[id];
	const index = nodeStageIndex[id];
	const isDecision = node.kind === "decision";
	const { x, y, w, h } = node;
	const chamfer = 14;
	const shape = isDecision
		? `M${x + chamfer} ${y} H${x + w - chamfer} L${x + w} ${y + chamfer} V${y + h - chamfer} L${x + w - chamfer} ${y + h} H${x + chamfer} L${x} ${y + h - chamfer} V${y + chamfer} Z`
		: null;

	return (
		<g className="arch-reveal">
			<g
				aria-label={`${node.title}: ${stages[index].title}`}
				className={`arch-node arch-${node.flow} arch-kind-${node.kind} ${stateFor(index, stage)}`}
				onClick={() => onSelect(index)}
				onKeyDown={(event) => {
					if (event.key === "Enter" || event.key === " ") {
						event.preventDefault();
						onSelect(index);
					}
				}}
				role="button"
				tabIndex={0}
			>
				{isDecision ? (
					<path
						className="arch-node-shape"
						d={shape}
					/>
				) : (
					<rect
						className="arch-node-shape"
						height={h}
						rx="14"
						width={w}
						x={x}
						y={y}
					/>
				)}
				<g
					className="arch-glyph"
					transform={`translate(${x + 14} ${y + 14}) scale(0.92)`}
				>
					{glyphs[id].map((d) => (
						<path
							d={d}
							key={d}
						/>
					))}
				</g>
				<NodeDecor
					id={id}
					node={node}
				/>
				<text
					className="arch-title"
					x={x + 16}
					y={y + 58}
				>
					{node.title}
				</text>
				<text
					className="arch-sub"
					x={x + 16}
					y={y + 75}
				>
					{node.sub}
				</text>
			</g>
		</g>
	);
}

function Store({ stage, onSelect }) {
	const ingested = stage >= STAGE.ingested;
	const embedded = stage >= STAGE.embedded;
	const ready = stage >= STAGE.ready;
	const querying = stage >= STAGE.retrieved - 1;
	const causal = stage >= STAGE.retrieved;
	const evidence = stage >= STAGE.evidence;
	const reading = stage === STAGE.retrieved;
	const { x, y, w, h } = STORE;
	const index = STAGE.ready;

	return (
		<g className="arch-reveal">
			<g
				aria-label="PostgreSQL and pgvector knowledge store"
				className={`arch-store ${stateFor(index, stage)} ${reading ? "is-reading" : ""} ${ready ? "is-ready" : ""}`}
				onClick={() => onSelect(index)}
				onKeyDown={(event) => {
					if (event.key === "Enter" || event.key === " ") {
						event.preventDefault();
						onSelect(index);
					}
				}}
				role="button"
				tabIndex={0}
			>
				<rect
					className="arch-store-platter"
					height={h}
					rx="20"
					width={w - 48}
					x={x + 24}
					y={y + 14}
				/>
				<rect
					className="arch-store-platter is-mid"
					height={h}
					rx="20"
					width={w - 24}
					x={x + 12}
					y={y + 7}
				/>
				<rect
					className="arch-store-shape"
					height={h}
					rx="20"
					width={w}
					x={x}
					y={y}
				/>

				<g
					className="arch-store-icon"
					transform={`translate(${x + 22} ${y + 18})`}
				>
					<ellipse
						cx="10"
						cy="4"
						rx="8"
						ry="3"
					/>
					<path d="M2 4v12c0 1.7 3.6 3 8 3s8-1.3 8-3V4" />
					<path d="M2 10c0 1.7 3.6 3 8 3s8-1.3 8-3" />
				</g>
				<text
					className="arch-store-title"
					x={x + 52}
					y={y + 33}
				>
					PostgreSQL + pgvector
				</text>
				<text
					className="arch-store-sub"
					x={x + 236}
					y={y + 33}
				>
					authoritative temporal state · semantic index
				</text>
				<g className={`arch-ready ${ready ? "is-on" : ""}`}>
					<circle
						cx={x + w - 168}
						cy={y + 29}
						r="3.5"
					/>
					<text
						x={x + w - 158}
						y={y + 33}
					>
						knowledge available
					</text>
				</g>

				<rect
					className="arch-table"
					height="140"
					rx="12"
					width="220"
					x="60"
					y="290"
				/>
				<text
					className="arch-table-title"
					x="76"
					y="314"
				>
					raw_events
				</text>
				<text
					className="arch-table-sub"
					x="76"
					y="331"
				>
					append-only · keyed by event_id
				</text>
				{Array.from({ length: 12 }).map((_, cell) => {
					const isNew = cell === 11;
					return (
						<rect
							className={`arch-cell ${isNew ? (ingested ? "is-new" : "is-empty") : ""}`}
							height="14"
							key={cell}
							rx="3"
							width="26"
							x={76 + (cell % 6) * 32}
							y={350 + Math.floor(cell / 6) * 22}
						/>
					);
				})}
				<text
					className={`arch-table-sub arch-new-label ${ingested ? "is-on" : ""}`}
					x="76"
					y="414"
				>
					+ evt-1024-04
				</text>

				<rect
					className="arch-table"
					height="140"
					rx="12"
					width="880"
					x="300"
					y="290"
				/>
				<text
					className="arch-table-title"
					x="316"
					y="314"
				>
					knowledge_versions
				</text>
				<text
					className="arch-table-sub"
					x="452"
					y="314"
				>
					INC-1024 · one row per version
				</text>
				<text
					className="arch-table-sub"
					textAnchor="end"
					x="1164"
					y="314"
				>
					embedding
				</text>

				{versions.map((version, row) => {
					const present = version.v < 4 || ingested;
					const isLatest = version.v === 4 || (version.v === 3 && !ingested);
					const end = isLatest ? OPEN_END : version.end;
					const rowY = 338 + row * 20;
					const future = causal && version.start > AS_OF;
					const hit = evidence && version.v === 2;
					const candidate = causal && !future;
					const vecLit = version.v < 4 || embedded;
					return (
						<g
							className={`arch-version is-v${version.v} ${present ? "is-present" : ""} ${future ? "is-future" : ""} ${candidate ? "is-candidate" : ""} ${hit ? "is-hit" : ""}`}
							key={version.v}
						>
							<text
								className="arch-version-label"
								x="316"
								y={rowY + 11}
							>
								v{version.v}
							</text>
							<rect
								className={`arch-version-bar ${isLatest ? "is-open" : ""}`}
								height="15"
								rx="4"
								style={{ width: present ? tx(end) - tx(version.start) : 0 }}
								x={tx(version.start)}
								y={rowY}
							/>
							<text
								className="arch-version-text"
								x={tx(version.start) + 8}
								y={rowY + 11}
							>
								{version.status}
							</text>
							<g className={`arch-vec ${vecLit && present ? "is-on" : ""}`}>
								{vecHeights[row].map((height, bar) => (
									<rect
										height={height}
										key={bar}
										width="3.5"
										x={1130 + bar * 5.5}
										y={rowY + 14 - height}
									/>
								))}
							</g>
						</g>
					);
				})}

				{[
					["10:10", 10],
					["10:30", 30],
					["10:45", 45],
					["11:00", 60],
					["open", OPEN_END],
				].map(([label, minute]) => (
					<text
						className="arch-axis"
						key={label}
						textAnchor="middle"
						x={tx(minute)}
						y="424"
					>
						{label}
					</text>
				))}

				<g className={`arch-asof ${querying ? "is-on" : ""}`}>
					<line
						x1={tx(AS_OF)}
						x2={tx(AS_OF)}
						y1="334"
						y2="414"
					/>
					<text
						textAnchor="middle"
						x={tx(AS_OF)}
						y="330"
					>
						query time 10:35
					</text>
				</g>
			</g>
		</g>
	);
}

function Answer({ stage, onSelect }) {
	const index = STAGE.answered;
	const { x, y, w, h } = ANSWER;
	return (
		<g className="arch-reveal">
			<g
				aria-label="Grounded response with citations"
				className={`arch-answer ${stateFor(index, stage)}`}
				onClick={() => onSelect(index)}
				onKeyDown={(event) => {
					if (event.key === "Enter" || event.key === " ") {
						event.preventDefault();
						onSelect(index);
					}
				}}
				role="button"
				tabIndex={0}
			>
				<rect
					className="arch-answer-shape"
					height={h}
					rx="18"
					width={w}
					x={x}
					y={y}
				/>
				<path
					className="arch-answer-check"
					d={`M${x + 24} ${y + 27} l4 4 8-8.5`}
				/>
				<text
					className="arch-answer-label"
					x={x + 46}
					y={y + 31}
				>
					Grounded response
				</text>
				<text
					className="arch-answer-note"
					textAnchor="end"
					x={x + w - 24}
					y={y + 31}
				>
					illustrative · demo_scenario.json
				</text>
				<text
					className="arch-answer-text"
					x={x + 24}
					y={y + 62}
				>
					As of 10:35, INC-1024 was root_cause_identified — database
				</text>
				<text
					className="arch-answer-text"
					x={x + 24}
					y={y + 82}
				>
					connection pool exhaustion.
				</text>
				{[
					{ label: "[1] v2 · 10:30 → 10:45 · Δt 5 min", width: 214 },
					{ label: "query_time_used 10:35", width: 150 },
					{ label: "diagnostics · St Sr Sc tier", width: 178 },
				].reduce(
					(acc, chip) => {
						acc.items.push(
							<g
								className="arch-chip"
								key={chip.label}
							>
								<rect
									height="22"
									rx="6"
									width={chip.width}
									x={acc.cursor}
									y={y + 96}
								/>
								<text
									x={acc.cursor + 10}
									y={y + 111}
								>
									{chip.label}
								</text>
							</g>
						);
						acc.cursor += chip.width + 8;
						return acc;
					},
					{ cursor: x + 24, items: [] }
				).items}
			</g>
		</g>
	);
}

function Legend() {
	const items = [
		{ kind: "process", label: "Processing" },
		{ kind: "transport", label: "Transport" },
		{ kind: "storage", label: "Persistent storage" },
		{ kind: "decision", label: "Decision / gating" },
		{ kind: "output", label: "Output" },
		{ kind: "packet", label: "Event or query in flight" },
	];
	return (
		<g className="arch-reveal arch-legend">
			<text
				className="arch-legend-title"
				x="40"
				y="664"
			>
				LEGEND
			</text>
			{items.map((item, index) => {
				const col = index % 2;
				const row = Math.floor(index / 2);
				const lx = 40 + col * 230;
				const ly = 686 + row * 30;
				return (
					<g
						className={`arch-legend-item is-${item.kind}`}
						key={item.kind}
					>
						{item.kind === "packet" ? (
							<circle
								cx={lx + 12}
								cy={ly + 7}
								r="4.5"
							/>
						) : item.kind === "decision" ? (
							<path d={`M${lx + 5} ${ly} H${lx + 19} L${lx + 24} ${ly + 5} V${ly + 9} L${lx + 19} ${ly + 14} H${lx + 5} L${lx} ${ly + 9} V${ly + 5} Z`} />
						) : (
							<rect
								height="14"
								rx={item.kind === "storage" ? 4 : 4}
								width="24"
								x={lx}
								y={ly}
							/>
						)}
						<text
							x={lx + 36}
							y={ly + 11}
						>
							{item.label}
						</text>
					</g>
				);
			})}
		</g>
	);
}

export default function ArchitectureDiagram({ stage, onSelect, registerPath, packetRef, packetFlow }) {
	return (
		<svg
			aria-labelledby="arch-svg-title"
			className="arch-svg"
			role="group"
			viewBox={`0 0 ${VIEW.width} ${VIEW.height}`}
		>
			<title id="arch-svg-title">
				StreamRAG architecture: continuous ingestion into PostgreSQL and pgvector, and temporal query processing
			</title>
			<defs>
				{["idle", "ingest", "query"].map((tone) => (
					<marker
						className={`arch-marker is-${tone}`}
						id={`arch-arrow-${tone}`}
						key={tone}
						markerHeight="8"
						markerUnits="userSpaceOnUse"
						markerWidth="8"
						orient="auto"
						refX="7"
						refY="4"
					>
						<path d="M1 1 L7 4 L1 7" />
					</marker>
				))}
				<linearGradient
					id="arch-store-fill"
					x1="0"
					x2="0"
					y1="0"
					y2="1"
				>
					<stop
						offset="0"
						stopColor="#111726"
					/>
					<stop
						offset="1"
						stopColor="#0b0f19"
					/>
				</linearGradient>
				<linearGradient
					id="arch-answer-fill"
					x1="0"
					x2="1"
					y1="0"
					y2="1"
				>
					<stop
						offset="0"
						stopColor="#14122a"
					/>
					<stop
						offset="1"
						stopColor="#0d1018"
					/>
				</linearGradient>
			</defs>

			<g className="arch-reveal arch-lane-label is-ingest">
				<rect
					height="22"
					rx="11"
					width="62"
					x="40"
					y="26"
				/>
				<text
					className="arch-lane-tag"
					x="71"
					y="41"
				>
					FLOW A
				</text>
				<text
					className="arch-lane-name"
					x="114"
					y="42"
				>
					Continuous ingestion
				</text>
				<text
					className="arch-lane-note"
					textAnchor="end"
					x="1200"
					y="42"
				>
					offset committed after processing
				</text>
			</g>
			<g className="arch-reveal arch-lane-label is-query">
				<rect
					height="22"
					rx="11"
					width="62"
					x="440"
					y="469"
				/>
				<text
					className="arch-lane-tag"
					x="471"
					y="484"
				>
					FLOW B
				</text>
				<text
					className="arch-lane-name"
					x="514"
					y="485"
				>
					Temporal query
				</text>
				<text
					className="arch-lane-note"
					textAnchor="end"
					x="1200"
					y="485"
				>
					causal: event_time ≤ query_time
				</text>
			</g>

			<Store
				onSelect={onSelect}
				stage={stage}
			/>

			<g className="arch-edges">
				{Object.entries(edges).map(([id, edge]) => {
					const state = stateFor(edgeStageIndex[id], stage);
					const tone = state ? edge.flow : "idle";
					return (
						<path
							className={`arch-edge arch-${edge.flow} ${state}`}
							d={edge.d}
							key={id}
							markerEnd={`url(#arch-arrow-${tone})`}
							ref={(node) => registerPath(id, node)}
						/>
					);
				})}
				<text
					className="arch-edge-note"
					x="876"
					y="200"
				>
					INSERT version
				</text>
				<text
					className="arch-edge-note"
					x="1122"
					y="200"
				>
					UPDATE embedding
				</text>
				<text
					className="arch-edge-note"
					x="346"
					y="486"
				>
					top-10
				</text>
			</g>

			{Object.keys(nodes).map((id) => (
				<Node
					id={id}
					key={id}
					onSelect={onSelect}
					stage={stage}
				/>
			))}

			<Answer
				onSelect={onSelect}
				stage={stage}
			/>
			<Legend />

			<g
				className={`arch-packet is-${packetFlow}`}
				ref={packetRef}
			>
				<circle
					className="arch-packet-halo"
					r="11"
				/>
				<circle
					className="arch-packet-core"
					r="4.5"
				/>
			</g>
		</svg>
	);
}
