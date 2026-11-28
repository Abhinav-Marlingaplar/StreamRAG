import { useEffect, useState } from "react";
import { Link, NavLink, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { clearAuthToken } from "../lib/api";
import { Logo } from "../landing/ui";
import EventStream from "../pages/EventStream";
import Intelligence from "../pages/Intelligence";
import Overview from "../pages/Overview";
import Simulator from "../pages/Simulator";
import { Icon } from "./icons";
import { PipelineProvider, usePipeline } from "./PipelineContext";
import { StatusDot } from "./ui";
import "./app.css";

const NAV = [
	{ to: "/app/overview", label: "Overview", icon: "overview", hint: "System health" },
	{ to: "/app/stream", label: "Event Stream", icon: "stream", hint: "Live pipeline" },
	{ to: "/app/intelligence", label: "Intelligence", icon: "intelligence", hint: "Ask questions" },
	{ to: "/app/simulator", label: "Simulator", icon: "simulator", hint: "Generate events" },
];

function HealthPill() {
	const { status, error, loading } = usePipeline();
	let tone = "neutral";
	let text = "Connecting…";
	if (!loading && error && !status) {
		tone = "red";
		text = "API unreachable";
	} else if (status) {
		const connected = status.kafka_consumer_status === "connected";
		tone = error ? "amber" : connected ? "green" : "amber";
		text = error ? "Reconnecting…" : connected ? "Worker connected" : "Worker offline";
	}
	return (
		<div
			className="ap-health"
			title="Ingestion worker status, reported by the consumer process"
		>
			<StatusDot
				pulse={tone === "green"}
				tone={tone}
			/>
			<span>{text}</span>
		</div>
	);
}

function Nav({ onNavigate }) {
	return (
		<nav
			aria-label="Application"
			className="ap-nav"
		>
			{NAV.map((item) => (
				<NavLink
					className={({ isActive }) => `ap-nav-link ${isActive ? "is-active" : ""}`}
					key={item.to}
					onClick={onNavigate}
					to={item.to}
				>
					<Icon
						name={item.icon}
						size={17}
					/>
					<span>{item.label}</span>
				</NavLink>
			))}
		</nav>
	);
}

function Shell() {
	const navigate = useNavigate();
	const location = useLocation();
	const [sheet, setSheet] = useState(false);

	useEffect(() => {
		setSheet(false);
		window.scrollTo({ top: 0 });
	}, [location.pathname]);

	const logout = () => {
		clearAuthToken();
		navigate("/login");
	};

	return (
		<div className="ap">
			<aside className="ap-side">
				<Link
					className="ap-brand"
					to="/app/overview"
				>
					<Logo size={30} />
					<span>StreamRAG</span>
				</Link>
				<Nav />
				<div className="ap-side-foot">
					<HealthPill />
					<Link
						className="ap-side-link"
						to="/"
					>
						<Icon
							name="external"
							size={15}
						/>
						Website
					</Link>
					<button
						className="ap-side-link"
						onClick={logout}
						type="button"
					>
						<Icon
							name="logout"
							size={15}
						/>
						Log out
					</button>
				</div>
			</aside>

			<header className={`ap-topbar ${sheet ? "is-open" : ""}`}>
				<div className="ap-topbar-row">
					<Link
						className="ap-brand"
						to="/app/overview"
					>
						<Logo size={28} />
						<span>StreamRAG</span>
					</Link>
					<HealthPill />
					<button
						aria-expanded={sheet}
						aria-label={sheet ? "Close menu" : "Open menu"}
						className="ap-icon-btn"
						onClick={() => setSheet((open) => !open)}
						type="button"
					>
						<Icon name={sheet ? "close" : "menu"} />
					</button>
				</div>
				<div className="ap-sheet">
					<Nav onNavigate={() => setSheet(false)} />
					<div className="ap-sheet-foot">
						<Link
							className="ap-side-link"
							to="/"
						>
							Website
						</Link>
						<button
							className="ap-side-link"
							onClick={logout}
							type="button"
						>
							Log out
						</button>
					</div>
				</div>
			</header>

			<main className="ap-main">
				<div className="ap-content">
					<Routes>
						<Route
							element={<Overview />}
							path="/overview"
						/>
						<Route
							element={<EventStream />}
							path="/stream"
						/>
						<Route
							element={<Intelligence />}
							path="/intelligence"
						/>
						<Route
							element={<Simulator />}
							path="/simulator"
						/>
						<Route
							element={
								<Navigate
									replace
									to="/app/overview"
								/>
							}
							path="*"
						/>
					</Routes>
				</div>
			</main>
		</div>
	);
}

export default function AppShell() {
	return (
		<PipelineProvider>
			<Shell />
		</PipelineProvider>
	);
}
