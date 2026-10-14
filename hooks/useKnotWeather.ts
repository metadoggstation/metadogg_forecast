"use client";

import { useEffect, useState } from "react";

export interface KnotWeatherData {
  knot_crossing: number;
  tension_stress: number;
  topology_phase: string;
}

interface KnotWeatherState {
  weatherData: KnotWeatherData | null;
  isLoading: boolean;
  isError: boolean;
}

const ORACLE_URL =
  process.env.NEXT_PUBLIC_ORACLE_URL ??
  "http://localhost:8000/api/oracle/knot-weather";
const POLLING_INTERVAL_MS = 30_000;

function isKnotWeatherData(value: unknown): value is KnotWeatherData {
  if (typeof value !== "object" || value === null) return false;

  const data = value as Record<string, unknown>;
  return (
    typeof data.knot_crossing === "number" &&
    Number.isFinite(data.knot_crossing) &&
    typeof data.tension_stress === "number" &&
    Number.isFinite(data.tension_stress) &&
    typeof data.topology_phase === "string"
  );
}

export function useKnotWeather(): KnotWeatherState {
  const [state, setState] = useState<KnotWeatherState>({
    weatherData: null,
    isLoading: true,
    isError: false,
  });

  useEffect(() => {
    let isMounted = true;
    let isFetching = false;
    const controller = new AbortController();

    const fetchWeather = async () => {
      if (isFetching) return;
      isFetching = true;

      try {
        const response = await fetch(ORACLE_URL, { signal: controller.signal });
        if (!response.ok) {
          throw new Error(`Oracle request failed with status ${response.status}`);
        }

        const data: unknown = await response.json();
        if (!isKnotWeatherData(data)) {
          throw new Error("Oracle response does not match the knot weather schema");
        }

        if (isMounted) {
          setState({ weatherData: data, isLoading: false, isError: false });
        }
      } catch {
        if (isMounted && !controller.signal.aborted) {
          setState((current) => ({
            ...current,
            isLoading: false,
            isError: true,
          }));
        }
      } finally {
        isFetching = false;
      }
    };

    void fetchWeather();
    const intervalId = window.setInterval(() => {
      void fetchWeather();
    }, POLLING_INTERVAL_MS);

    return () => {
      isMounted = false;
      controller.abort();
      window.clearInterval(intervalId);
    };
  }, []);

  return state;
}
