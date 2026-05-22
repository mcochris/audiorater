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
import "./theme_toggle.js";

const directoryDiv = document.querySelector("#directory") as HTMLDivElement;
const currentPathDiv = document.querySelector("#currentPath") as HTMLDivElement;
const musicFilesDiv = document.querySelector("#musicfiles") as HTMLDivElement;
const backIconSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-arrow-left" viewBox="0 0 16 16"><path fill-rule="evenodd" d="M15 8a.5.5 0 0 0-.5-.5H2.707l3.147-3.146a.5.5 0 1 0-.708-.708l-4 4a.5.5 0 0 0 0 .708l4 4a.5.5 0 0 0 .708-.708L2.707 8.5H14.5A.5.5 0 0 0 15 8"/></svg> ';
const homeIconSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-house" viewBox="0 0 16 16"><path d="M8.707 1.5a1 1 0 0 0-1.414 0L.646 8.146a.5.5 0 0 0 .708.708L2 8.207V13.5A1.5 1.5 0 0 0 3.5 15h9a1.5 1.5 0 0 0 1.5-1.5V8.207l.646.647a.5.5 0 0 0 .708-.708L13 5.793V2.5a.5.5 0 0 0-.5-.5h-1a.5.5 0 0 0-.5.5v1.293zM13 7.207V13.5a.5.5 0 0 1-.5.5h-9a.5.5 0 0 1-.5-.5V7.207l5-5z"/></svg> ';
const favoriteIconSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="red" class="bi bi-heart-fill" viewBox="0 0 16 16"><path fill-rule="evenodd" d="M8 1.314C12.438-3.248 23.534 4.735 8 15-7.534 4.736 3.562-3.248 8 1.314"/></svg> ';
let homeDirectory = "";
let pathSeparator = "/";

let path = "";

function updateCurrentPathDisplay() {
	const favDir = localStorage.getItem("favoriteDirectory") || "";

	if (favDir && path === favDir) {
		currentPathDiv.innerHTML = `Current Path: ${path} ${favoriteIconSvg}`;
		return;
	}

	currentPathDiv.textContent = `Current Path: ${path}`;
}

function createActionLink(labelHtml: string, action: string, value?: string) {
	const link = document.createElement("a") as HTMLAnchorElement;

	link.innerHTML = labelHtml;
	link.href = "#";
	link.dataset.action = action;

	if (value) {
		link.dataset.value = value;
	}

	return link;
}

function appendNavItem(
	list: HTMLUListElement,
	shouldRender: boolean,
	labelHtml: string,
	action: string,
	value?: string,
) {
	if (!shouldRender) {
		return false;
	}

	const item = document.createElement("li") as HTMLLIElement;
	const link = createActionLink(labelHtml, action, value);

	item.appendChild(link);
	list.appendChild(item);

	return true;
}

directoryDiv.addEventListener("click", async (event) => {
	const target = (event.target as HTMLElement).closest("a[data-action]") as HTMLAnchorElement | null;

	if (!target || !directoryDiv.contains(target)) {
		return;
	}

	event.preventDefault();

	const action = target.dataset.action;
	const value = target.dataset.value;
	const favDir = localStorage.getItem("favoriteDirectory") || "";

	if (action === "set-favorite") {
		localStorage.setItem("favoriteDirectory", path);
		await listDirectories();
		return;
	}

	if (action === "open-directory" && value) {
		path = path === pathSeparator ? `${pathSeparator}${value}` : `${path}${pathSeparator}${value}`;
	} else if (action === "go-up") {
		path = path.split(pathSeparator).slice(0, -1).join(pathSeparator) || pathSeparator;
	} else if (action === "go-home") {
		path = homeDirectory;
	} else if (action === "go-favorite" && favDir) {
		path = favDir;
	} else {
		return;
	}

	await listDirectories();
});

musicFilesDiv.addEventListener("click", async (event) => {
	const target = event.target as HTMLElement;
	const playButton = target.closest("button[data-action='play-toggle']") as HTMLButtonElement | null;

	if (playButton && musicFilesDiv.contains(playButton)) {
		const filePath = playButton.dataset.filePath;

		if (!filePath) {
			return;
		}

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

		return;
	}

	const clearButton = target.closest("button[data-action='clear-rating']") as HTMLButtonElement | null;

	if (!clearButton || !musicFilesDiv.contains(clearButton)) {
		return;
	}

	const filePath = clearButton.dataset.filePath;
	const row = clearButton.closest("tr");

	if (!filePath || !row) {
		return;
	}

	row.querySelectorAll("input[type='radio']").forEach((radio) => {
		(radio as HTMLInputElement).checked = false;
	});

	await clearRating(filePath);
});

musicFilesDiv.addEventListener("change", (event) => {
	const radio = (event.target as HTMLElement).closest("input[type='radio'][data-file-path]") as HTMLInputElement | null;

	if (!radio || !musicFilesDiv.contains(radio)) {
		return;
	}

	const filePath = radio.dataset.filePath;
	const rating = Number(radio.dataset.rating);

	if (!filePath || Number.isNaN(rating)) {
		return;
	}

	void rateMusic(filePath, rating);
});

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
	updateCurrentPathDisplay();

	const dirs = await invoke("list_directories", { path }) as string[];
	const favDir = localStorage.getItem("favoriteDirectory") || "";
	const ul = document.createElement("ul") as HTMLUListElement;

	appendNavItem(
		ul,
		path !== pathSeparator,
		`${backIconSvg} Back`,
		"go-up",
	);

	appendNavItem(
		ul,
		path !== homeDirectory,
		`${homeIconSvg} Home`,
		"go-home",
	);

	appendNavItem(
		ul,
		Boolean(path !== favDir && path !== homeDirectory),
		`${favoriteIconSvg} Make fav dir`,
		"set-favorite",
	);

	appendNavItem(
		ul,
		Boolean(favDir && path !== favDir),
		`${favoriteIconSvg} Go to fav dir`,
		"go-favorite",
	);

	dirs.forEach((dir: string) => {
		const li = document.createElement("li") as HTMLLIElement;
		const link = createActionLink(dir, "open-directory", dir);

		// Display text
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
	await listDirectories();
}

initializeApp();

//=============================================================================
// List music files in the current path
// This function is called after listing directories to show music files in the same path
//=============================================================================
async function listMusicFiles() {
	const musicFiles = await invoke("get_music_files", { "path": path }) as string[];

	musicFilesDiv.textContent = "";

	if (musicFiles.length === 0) {
		musicFilesDiv.textContent = "No music files in this directory.";
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
		const tr = document.createElement("tr");

		//
		// Column 1: Play button
		//
		const playTd = document.createElement("td");

		const playButton = document.createElement("button");

		playButton.classList.add("play-button");
		playButton.dataset.action = "play-toggle";
		playButton.dataset.filePath = filePath;

		playButton.textContent = "Play";
		playButton.type = "button";

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
			radio.dataset.filePath = filePath;
			radio.dataset.rating = String(rating);

			// Get the current rating for this file and set the radio button if it matches
			// const fileSize = await invoke("get_file_size", { "pathname": filePath });
			// const lastModified = await invoke("get_modified_time", { "pathname": filePath });

			await invoke<number | null | false>("get_rating", { "pathname": filePath }).then((currentRating) => {
				if (currentRating === rating) {
					radio.checked = true;
				}
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
		clearButton.dataset.action = "clear-rating";
		clearButton.dataset.filePath = filePath;

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
