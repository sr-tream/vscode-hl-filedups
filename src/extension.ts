// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as path from 'path';

// Event emitter to signal decoration changes
const emitter = new vscode.EventEmitter<vscode.Uri>();
// Set of URIs to decorate
let dupUris = new Set<string>();
// URIs for other duplicated files
let otherUris = new Set<string>();

// FileDecorationProvider to decorate duplicate files in other groups
const decoProvider: vscode.FileDecorationProvider = {
	onDidChangeFileDecorations: emitter.event,
	provideFileDecoration(uri: vscode.Uri) {
		const key = uri.toString();
		if (dupUris.has(key)) {
            return { badge: '🖇️', color: new vscode.ThemeColor('charts.blue'), tooltip: 'File open in multiple groups' };
		}
		if (otherUris.has(key)) {
            return { badge: '🖇️', tooltip: 'File open in multiple groups' };
		}
	}
};

// Helper to extract URI from a tab
function getUriFromTab(tab: vscode.Tab): vscode.Uri | undefined {
	if (tab.input instanceof vscode.TabInputText) {
		return tab.input.uri;
	}
	return undefined;
}

// Update decorations based on the active editor
function updateDecorations(activeUri?: vscode.Uri) {
	const oldUris = new Set([...dupUris, ...otherUris]);
	dupUris.clear(); otherUris.clear();

	const fileUris = new Map<string, Set<string>>();
	const groupCount = new Map<string, Set<number>>();
	vscode.window.tabGroups.all.forEach((group, idx) => {
		const seen = new Set<string>();
		group.tabs.forEach(tab => {
			const uri = getUriFromTab(tab);
			if (!uri) return;
			const name = path.basename(uri.fsPath);
			const key = uri.toString();
			if (!fileUris.has(name)) fileUris.set(name, new Set());
			fileUris.get(name)!.add(key);
			if (!groupCount.has(name)) groupCount.set(name, new Set());
			if (!seen.has(name)) {
				groupCount.get(name)!.add(idx);
				seen.add(name);
			}
		});
	});

	const activeName = activeUri ? path.basename(activeUri.fsPath) : undefined;
	const activeKey = activeUri?.toString();

	for (const [name, groups] of groupCount) {
		if (groups.size < 2) continue;
		const uris = fileUris.get(name)!;
		if (name === activeName) {
			for (const key of uris) {
                if (key === activeKey) { dupUris.add(key); }
			}
		} else {
			for (const key of uris) { otherUris.add(key); }
		}
	}

	const changedUris = new Set([...oldUris, ...dupUris, ...otherUris]);
	for (const uriStr of changedUris) {
		emitter.fire(vscode.Uri.parse(uriStr));
	}
}

// Activate extension: register provider and event listeners
export function activate(context: vscode.ExtensionContext) {
	context.subscriptions.push(
		vscode.window.registerFileDecorationProvider(decoProvider)
	);
	context.subscriptions.push(
		vscode.window.onDidChangeActiveTextEditor(editor => {
			updateDecorations(editor?.document.uri);
		})
	);

	updateDecorations(vscode.window.activeTextEditor?.document.uri);
}

// Deactivate extension
export function deactivate() { }
