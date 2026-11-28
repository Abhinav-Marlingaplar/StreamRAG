import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { fetchPipeline, fetchSimulatorStreamStatus, fetchStatus } from "../lib/api";
import { errorMessage } from "../lib/format";

const PipelineContext = createContext(null);

const POLL_MS = 1500;
const EVENT_LIMIT = 120;

export function PipelineProvider({ children }) {
	const [state, setState] = useState({
		status: null,
		stream: null,
		events: [],
		counts: null,
		loading: true,
		error: "",
		lastOkAt: null,
	});
	const inFlight = useRef(false);
	const mounted = useRef(true);

	const refresh = useCallback(async () => {
		if (inFlight.current) return;
		inFlight.current = true;
		try {
			const [status, stream, pipeline] = await Promise.all([
				fetchStatus(),
				fetchSimulatorStreamStatus(),
				fetchPipeline(EVENT_LIMIT),
			]);
			if (!mounted.current) return;
			setState({
				status,
				stream,
				events: pipeline.events,
				counts: pipeline.counts,
				loading: false,
				error: "",
				lastOkAt: Date.now(),
			});
		} catch (error) {
			if (!mounted.current) return;
			setState((prev) => ({
				...prev,
				loading: false,
				error: errorMessage(error, "Unable to read pipeline state."),
			}));
		} finally {
			inFlight.current = false;
		}
	}, []);

	useEffect(() => {
		mounted.current = true;
		refresh();
		const tick = () => {
			if (document.visibilityState === "visible") refresh();
		};
		const id = setInterval(tick, POLL_MS);
		document.addEventListener("visibilitychange", tick);
		return () => {
			mounted.current = false;
			clearInterval(id);
			document.removeEventListener("visibilitychange", tick);
		};
	}, [refresh]);

	const value = useMemo(() => ({ ...state, refresh }), [state, refresh]);
	return <PipelineContext.Provider value={value}>{children}</PipelineContext.Provider>;
}

export function usePipeline() {
	const value = useContext(PipelineContext);
	if (!value) throw new Error("usePipeline must be used inside PipelineProvider");
	return value;
}
