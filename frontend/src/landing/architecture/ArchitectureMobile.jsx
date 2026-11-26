import { FLOWS, nodes, stages } from "./stages";

const labelFor = (stage) => {
	if (stage.node === "store") return { title: "PostgreSQL + pgvector", sub: "raw_events · knowledge_versions" };
	if (stage.node === "answer") return { title: "Grounded response", sub: "answer · citations · diagnostics" };
	return nodes[stage.node];
};

export default function ArchitectureMobile({ stage, onSelect }) {
	return (
		<div className="arch-mobile">
			{Object.entries(FLOWS).map(([flow, meta]) => (
				<div
					className={`arch-m-flow is-${flow}`}
					key={flow}
				>
					<p className="arch-m-flow-label">
						<span>{meta.label}</span>
						{meta.name}
					</p>
					<ol className="arch-m-list">
						{stages.map((item, index) => {
							if (item.flow !== flow) return null;
							const label = labelFor(item);
							const state = index === stage ? "is-active" : index < stage ? "is-done" : "";
							const kind = item.node === "store" ? "is-store" : item.node === "answer" ? "is-answer" : "";
							return (
								<li
									className={`arch-m-step ${state} ${kind}`}
									key={item.title}
								>
									<button
										aria-current={index === stage ? "step" : undefined}
										onClick={() => onSelect(index)}
										type="button"
									>
										<span className="arch-m-dot" />
										<span className="arch-m-text">
											<span className="arch-m-title">{label.title}</span>
											<span className="arch-m-sub">{label.sub}</span>
										</span>
									</button>
									<div className="arch-m-detail">
										<div>
											<p className="arch-m-detail-title">{item.title}</p>
											<p>{item.body}</p>
										</div>
									</div>
								</li>
							);
						})}
					</ol>
				</div>
			))}
		</div>
	);
}
