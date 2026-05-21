import { invoke } from "@tauri-apps/api/core";
import {
	PhysicalPosition,
	PhysicalSize,
	currentMonitor,
	getCurrentWindow,
} from "@tauri-apps/api/window";

import "bootstrap/dist/css/bootstrap.min.css";
// @ts-expect-error - bootstrap doesn't have type definitions
import * as bootstrap from "bootstrap";

const directoryDiv = document.querySelector("#directory") as HTMLDivElement;
const currentPathDiv = document.querySelector("#currentPath") as HTMLDivElement;
const backButton = document.querySelector("#backButton") as HTMLInputElement;
const homeButton = document.querySelector("#homeButton") as HTMLInputElement;
let homeDirectory = "";
let pathSeparator = "/";

let path = "";

//=============================================================================
// Resize and center the window to use most of the current monitor work area
//=============================================================================
async function resizeWindowToDisplay() {
	if (!("__TAURI_INTERNALS__" in window)) {
		return;
	}

	try {
		const monitor = await currentMonitor();

		if (!monitor) {
			return;
		}

		const workArea = monitor.workArea;
		const targetWidth = Math.floor(workArea.size.width * 0.5);
		const targetHeight = Math.floor(workArea.size.height * 0.5);

		const x = workArea.position.x + Math.floor((workArea.size.width - targetWidth) / 2);
		const y = workArea.position.y + Math.floor((workArea.size.height - targetHeight) / 2);

		const appWindow = getCurrentWindow();

		await appWindow.setSize(new PhysicalSize(targetWidth, targetHeight));
		await appWindow.setPosition(new PhysicalPosition(x, y));
	} catch (error) {
		console.warn("Unable to resize window on startup:", error);
	}
}

//=============================================================================
// List directories and music files in the current path
// This function is called on initial load and whenever the path changes
//=============================================================================
async function listDirectories() {
	// Clear previous directory list
	directoryDiv.innerHTML = "";

	const dirs = await invoke("list_directories", { path }) as string[];

	const ul = document.createElement("ul");

	dirs.forEach((dir: string) => {
		const li = document.createElement("li") as HTMLLIElement;
		const link = document.createElement("a") as HTMLAnchorElement;

		// Display text
		link.textContent = dir;

		// Optional styling
		link.href = "#";

		// Add click handler immediately
		link.addEventListener("click", (event) => {
			event.preventDefault();

			// Build next path
			if (path === pathSeparator) {
				path = `${pathSeparator}${dir}`;
			} else {
				path = `${path}${pathSeparator}${dir}`;
			}

			currentPathDiv.textContent = `Current Path: ${path}`;

			listDirectories();
		});

		li.appendChild(link);
		ul.appendChild(li);
	});

	directoryDiv.appendChild(ul);

	await listMusicFiles();
}

//=============================================================================
// Initial display
//=============================================================================
async function initializeApp() {
	await resizeWindowToDisplay();

	homeDirectory = await invoke("get_home_directory") as string;
	pathSeparator = await invoke("get_path_separator") as string;
	path = homeDirectory;
	currentPathDiv.textContent = `Current Path: ${path}`;
	await listDirectories();
}

initializeApp();

//=============================================================================
// List music files in the current path
// This function is called after listing directories to show music files in the same path
//=============================================================================
async function listMusicFiles() {
	const musicFiles = await invoke("get_music_files", { "path": path }) as string[];

	const musicFilesDiv = document.querySelector("#musicfiles") as HTMLDivElement;

	musicFilesDiv.textContent = "";

	if (musicFiles.length === 0) {
		musicFilesDiv.textContent = "No music files";
		return;
	}

	const table = await createMusicTable(musicFiles);
	musicFilesDiv.appendChild(table);
}

//=============================================================================
// Create a table to display music files with play buttons and rating options
// This function generates a table where each row represents a music file, with a play button and rating radio buttons
//=============================================================================
async function createMusicTable(musicFiles: string[]) {
	const table = document.createElement("table");
	const tbody = document.createElement("tbody");

	for (const [index, filePath] of musicFiles.entries()) {
		// const fileSize = await invoke("get_file_size", { "pathname": filePath });
		// const lastModified = await invoke("get_modified_time", { "pathname": filePath });
		const tr = document.createElement("tr");

		//
		// Column 1: Play button
		//
		const playTd = document.createElement("td");

		const playButton = document.createElement("button");

		playButton.classList.add("play-button");

		playButton.textContent = "Play";
		playButton.type = "button";

		// Call playMusic(pathname)
		playButton.addEventListener("click", async () => {
			if (playButton.textContent === "Play") {
				document.querySelectorAll(".play-button").forEach((button) => {
					(button as HTMLButtonElement).textContent = "Play";
				});

				await playMusic(filePath);
				playButton.textContent = "Stop";
			} else {
				await stopMusic();
				playButton.textContent = "Play";
			}
		});

		playTd.appendChild(playButton);

		//
		// Column 2: Rating radio buttons + Clear button
		//
		const ratingTd = document.createElement("td");

		for (let rating = 1; rating <= 5; rating++) {
			const label = document.createElement("label");
			const radio = document.createElement("input");

			radio.type = "radio";
			radio.name = `rating-${index}`;
			radio.value = String(rating);

			// Get the current rating for this file and set the radio button if it matches
			// const fileSize = await invoke("get_file_size", { "pathname": filePath });
			// const lastModified = await invoke("get_modified_time", { "pathname": filePath });

			await invoke<number | null | false>("get_rating", { "pathname": filePath }).then((currentRating) => {
				if (currentRating === rating) {
					radio.checked = true;
				}
			});

			// Call rateMusic(pathname)
			radio.addEventListener("change", () => {
				rateMusic(filePath, rating);
			});

			label.appendChild(radio);

			label.appendChild(
				document.createTextNode(` ${rating} `)
			);

			ratingTd.appendChild(label);
		}

		//
		// Clear button
		//
		const clearButton = document.createElement("button");

		clearButton.textContent = "Clear";
		clearButton.type = "button";

		clearButton.addEventListener("click", () => {
			const radios = ratingTd.querySelectorAll(
				"input[type='radio']"
			);

			radios.forEach((radio) => {
				(radio as HTMLInputElement).checked = false;
			});

			// Call clearRating(pathname)
			clearRating(filePath);
		});

		ratingTd.appendChild(clearButton);

		//
		// Column 3: File pathname
		//
		const fileTd = document.createElement("td");

		fileTd.textContent = filePath.split(pathSeparator as string).pop() || filePath;

		//
		// Assemble row
		//
		tr.appendChild(playTd);
		tr.appendChild(ratingTd);
		tr.appendChild(fileTd);

		tbody.appendChild(tr);
	}

	table.appendChild(tbody);

	return table;
}

//=============================================================================
// Play and stop music functions
//=============================================================================
async function playMusic(pathname: string) {
	await invoke("play_music_file", { "pathname": pathname });
}

async function stopMusic() {
	await invoke("stop_music_file");
}

//=============================================================================
// Rate music and clear rating functions
//=============================================================================
async function rateMusic(pathname: string, rating: number) {
	await invoke("rate_music_file", { "pathname": pathname, "rating": rating });
}

async function clearRating(pathname: string) {
	await invoke("clear_rating", { "pathname": pathname });
}

//=============================================================================
// Back button handler
// This allows navigating up one directory level, but not above the root
//=============================================================================
backButton.addEventListener("click", () => {
	if (path !== pathSeparator) {
		path = path.split(pathSeparator).slice(0, -1).join(pathSeparator) || pathSeparator;
		currentPathDiv.textContent = `Current Path: ${path}`;
		listDirectories();
	}
});

//=============================================================================
// Home button handler
// This resets the path to the user's home directory
//=============================================================================
homeButton.addEventListener("click", () => {
	path = homeDirectory;
	currentPathDiv.textContent = `Current Path: ${path}`;
	listDirectories();
});
