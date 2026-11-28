import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import AppShell from "./app/AppShell";
import ProtectedRoute from "./components/ProtectedRoute";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Register from "./pages/Register";

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
						<AppShell />
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
