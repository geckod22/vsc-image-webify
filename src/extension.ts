import * as vscode from 'vscode';
import * as path from 'path';
import sharp from 'sharp';

const qualityOptions = [
	{ label: 'High (100)', value: 100 },
	{ label: 'Balanced (80)', value: 80 },
	{ label: 'Medium (50)', value: 50 },
	{ label: 'Low (30)', value: 30 },
	{ label: 'Very Low (15)', value: 15 }
];

const filesHandler = async(uri: vscode.Uri, uris: vscode.Uri[], format: 'webp' | 'avif') => {
	const targets = uris && uris.length > 0 ? uris : [uri];

	const supportedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.tiff'];

    const files = targets.filter(u => {
        const isFile = u.scheme === 'file';
        const isImage = supportedExtensions.includes(path.extname(u.fsPath).toLowerCase());
        return isFile && isImage;
    });

    if (files.length === 0) {
		vscode.window.showWarningMessage("No valid images have been selected for conversion.");
		return;
	}

	if (files.length < targets.length) {
        vscode.window.setStatusBarMessage(`${targets.length - files.length} file(s) have been ignored because they are not supported.`, 3000);
    }

	const config = vscode.workspace.getConfiguration('image-webify');
	let quality = (format === 'webp' ? config.get<number>('defaultQualityWebp') : config.get<number>('defaultQualityAvif')) || 80;
    const askAlways = (format === 'webp' ? config.get<boolean>('askForQualityWebp') : config.get<boolean>('askForQualityAvif')) || false;

	if (askAlways) {
		const selected = await vscode.window.showQuickPick(qualityOptions, {
			placeHolder: `Select quality for ${files.length} file(s) (default: ${quality}%)`
		});
		if (!selected) { return ''; }
		quality = selected.value;
	}

	try {
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Converting ${files.length} image(s) to ${format.toUpperCase()}...`,
            cancellable: false
        }, async () => {
            const promises = files.map(f => conversionProcess(f.fsPath, format, quality));
            await Promise.all(promises);
        });

        vscode.window.showInformationMessage(`Successfully converted ${files.length} files!`);
    } catch (err: any) {
        vscode.window.showErrorMessage(`Multi-conversion error: ${err.message}`);
    }
};

const conversionProcess = async (inputPath: string, format: 'webp' | 'avif', quality: number = 80): Promise<string> => {
		const outputPath = inputPath.replace(path.extname(inputPath), '.' + format);
		await sharp(inputPath)
			.toFormat(format, { quality: quality })
			.toFile(outputPath);
		return outputPath;
};

export function activate(context: vscode.ExtensionContext) {

	const convertToWebp = vscode.commands.registerCommand('image-webify.convertToWebp', 
        async (uri: vscode.Uri, uris: vscode.Uri[]) => {
            await filesHandler(uri, uris, 'webp');
        }
    );

    const convertToAvif = vscode.commands.registerCommand('image-webify.convertToAvif', 
        async (uri: vscode.Uri, uris: vscode.Uri[]) => {
            await filesHandler(uri, uris, 'avif');
        }
    );

	context.subscriptions.push(convertToWebp, convertToAvif);
}

export function deactivate() {}
