import { useMemo } from "react";
import { BrowserRouter, Link, NavLink, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import { clearAuthToken } from "./lib/api";
import Intelligence from "./pages/Intelligence";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Overview from "./pages/Overview";
import Register from "./pages/Register";
import Simulator from "./pages/Simulator";

function Layout() {
	const navigate = useNavigate();
	const navItems = useMemo(
		() => [
			{ label: "Overview", to: "/app/overview" },
			{ label: "Intelligence", to: "/app/intelligence" },
			{ label: "Event Simulator", to: "/app/simulator" },
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
						path="/overview"
						element={<Overview />}
					/>
					<Route
						path="/intelligence"
						element={<Intelligence />}
					/>
					<Route
						path="/simulator"
						element={<Simulator />}
					/>
					<Route
						path="*"
						element={
							<Navigate
								to="/app/overview"
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