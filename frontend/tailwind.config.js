/** @type {import('tailwindcss').Config} */
export default {
	content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
	theme: {
		extend: {
			colors: {
				ink: "#090d1a",
				panel: "#0d1222",
				accent: "#5f7cff",
			},
		},
	},
	plugins: [],
};