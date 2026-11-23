import { useMemo } from "react";
import { BrowserRouter, Link, NavLink, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import { clearAuthToken } from "./lib/api";
import Chat from "./pages/Chat";
import Dashboard from "./pages/Dashboard";
import Events from "./pages/Events";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Monitoring from "./pages/Monitoring";
import Register from "./pages/Register";
import Simulator from "./pages/Simulator";
import Timeline from "./pages/Timeline";

function Layout() {
	const navigate = useNavigate();
	const navItems = useMemo(
		() => [
			{ label: "Dashboard", to: "/app/dashboard" },
			{ label: "Chat", to: "/app/chat" },
			{ label: "Events", to: "/app/events" },
			{ label: "Timeline", to: "/app/timeline/INC-1024" },
			{ label: "Simulator", to: "/app/simulator" },
			{ label: "Monitoring", to: "/app/monitoring" },
		],
		[]
	);

	return (
		<div className="app-shell">
			<header className="app-topbar glass-panel">
				<div className="topbar-brand">
					<p className="sidebar-brand">StreamRAG</p>
					<p className="sidebar-sub">Temporal Intelligence Platform</p>
				</div>
				<nav className="topbar-nav">
					{navItems.map((item) => (
						<NavLink
							key={item.to}
							className={({ isActive }) => `sidebar-link ${isActive ? "active" : ""}`}
							to={item.to}
						>
							{item.label}
						</NavLink>
					))}
				</nav>
				<div className="topbar-actions">
					<Link
						className="btn btn-ghost"
						to="/"
					>
						Website
					</Link>
					<button
						className="btn btn-ghost"
						onClick={() => {
							clearAuthToken();
							navigate("/login");
						}}
						type="button"
					>
						Log out
					</button>
				</div>
			</header>
			<main className="app-main app-main-wide">
				<Routes>
					<Route
						path="/dashboard"
						element={<Dashboard />}
					/>
					<Route
						path="/chat"
						element={<Chat />}
					/>
					<Route
						path="/events"
						element={<Events />}
					/>
					<Route
						path="/timeline/:entityId"
						element={<Timeline />}
					/>
					<Route
						path="/simulator"
						element={<Simulator />}
					/>
					<Route
						path="/monitoring"
						element={<Monitoring />}
					/>
					<Route
						path="*"
						element={
							<Navigate
								to="/app/dashboard"
								replace
							/>
						}
					/>
				</Routes>
			</main>
		</div>
	);
}

function RouterTree() {
	return (
		<Routes>
			<Route
				path="/"
				element={<Landing />}
			/>
			<Route
				path="/login"
				element={<Login />}
			/>
			<Route
				path="/register"
				element={<Register />}
			/>
			<Route
				path="/app/*"
				element={
					<ProtectedRoute>
						<Layout />
					</ProtectedRoute>
				}
			/>
			<Route
				path="*"
				element={
					<Navigate
						to="/"
						replace
					/>
				}
			/>
		</Routes>
	);
}

export default function App() {
	return (
		<BrowserRouter>
			<RouterTree />
		</BrowserRouter>
	);
}