import * as vscode from 'vscode';
import { window } from 'vscode';
import { basename } from 'path';
import * as child_process from 'child_process';
import { cwd, stdout } from 'process';
import { promises } from 'dns';

var path = require("path");

export function activate(context: vscode.ExtensionContext) {

	console.log('Congratulations, your extension "gitsight" is now active!');


	context.subscriptions.push(vscode.commands.registerCommand("gitsight.checkMerge", async () => {
	
	   const filePath = await getActiveFilePath();

	   if (filePath) {
        vscode.window.showInformationMessage(filePath);
      } else{
		vscode.window.showWarningMessage("No active editor found");
	  }

	}))
}


// This method is called when your extension is deactivated
export function deactivate() {}

async function getActiveFilePath(): Promise<any> {

	let gitDirExits
	let path : string
    let uri : vscode.Uri
	const editor: any = window.activeTextEditor;
	if (!editor) {
		return null;
	}

	//console.log(editor.document.uri)
    //console.log(editor.document.uri.fsPath) //it gives c:\Users\Dhinesh\Desktop\repos\fetquest-genai\pages\2_Chatbot.py

	const wsuri = vscode.workspace.getWorkspaceFolder(editor.document.uri)
	//console.log("*************")
	//console.log(wsuri!.uri.fsPath) //c:\Users\Dhinesh\Desktop\repos\fetquest-genai
	path = wsuri!.uri.fsPath
	uri = vscode.Uri.file(path)
	//vscode.workspace.fs.readDirectory(uri)
	try{

		//validating git directory

		gitDirExits =   await readDirectory(uri)

		if(!gitDirExits){
			return "Not a git directory to proceed the validation"
		}

		//fetch all branches from the remote
		const fetch_branch = await fetch_branches(path);
		console.log("Fetch branches after resolve")
		console.log( fetch_branch)


		//getting branches intostring array

		const br = await cp_process(path);
		const new_branch = br.map( bl => bl.trim()).filter(Boolean);
		let s = new Set(new_branch);
		let new_brnc  = [...s]

		//pick a branch to validate

		const selected_bran  = await select_branch(new_brnc);

		if (!selected_bran) {
			//vscode.window.showWarningMessage("No branch selected");
			return "No branch selected, operation cancelled";
			}
		console.log("Selected Branch is ", selected_bran)


		//git diff

		const diff_count = await diff_check(path,selected_bran)
		console.log("The Number files changed is ", diff_count)


		//validating the git diff

		if(diff_count > 0) {

			const base_sha = await get_git_base(path,selected_bran)
			console.log("The Base SHA is " + base_sha);

			const merge_validation = await merge_check(path, selected_bran, base_sha);

			console.log("Whether there is conflict ? " + merge_validation);

			if (merge_validation === "yes") {

					return `The Merge will result in conflict and has ${diff_count} new changes`;
			} else{

				return `Good to Merge and has ${diff_count} modified`;
			}

		} else if(diff_count == 0) {
			return `Good to Push and Merge with ${selected_bran}, no new changes introduced in ${selected_bran}`
		}

	}
	catch (err){
		console.log("Error in git flow", err)
	}


	// return editor.document.uri.fsPath

}


async function cp_process(path:string){

	const br : string[] = await childprocess_branch(path);

	return br

}


async function fetch_branches(path:string) {

	console.log("fetching the data")

	const fetch_data = await fetch_all_branches(path)

	console.log("fetching the data completed")

	return fetch_data


}
async function select_branch(avail_branch : string[]){

		const selected_branch = await showQuickPick(avail_branch)

		return selected_branch

	}

async function get_git_base(path: string,selected_branch : string){

		const git_base = await git_target_base(path, selected_branch)

		return git_base

	}

async function diff_check(path: string,selected_branch : string){

		const git_diff_count = await git_diff_check(path, selected_branch)

		return git_diff_count

	}

async function merge_check(path: string,selected_branch : string, target_base_sha : string){

		let is_conflicted:string

		const merge_reponse = await git_merge_check(path, selected_branch,target_base_sha)

		if(merge_reponse.includes("<<<<<<<")){
			console.log("This is conflicted")

			is_conflicted = "yes"

			return is_conflicted 

		} else {

			is_conflicted = "no"

			return is_conflicted 
		}


	}


async function readDirectory(folderPath: vscode.Uri) {
  try {
    const files = await vscode.workspace.fs.readDirectory(folderPath);
    // files is an array of filenames (strings)
    for (const file of files) {
      console.log(file[0]);

	  if(file[0] === ".git"){
		console.log(".git ffound this is git directory")

		return true
	  } else {
		return false
	  }
	  
	  
    }
  } catch (err) {
    console.error('Error reading directory:', err);
  }
}



function childprocess_branch(path: any) :Promise<any> {
	return new Promise((resolve, reject) => {
	let br : string [] = []
		child_process.exec(`git  -C ${path} branch -a`, (error, stdout, stderr) => { 

		if(error){
			console.log("This is error")
			reject(error);
			return
		}

		if(stdout) {
		//console.log(`stdout: ${stdout}`);

		const tesp = stdout.toString().split(" ")

		//const new_br = tesp.forEach(myFunction)

	    tesp.map( item => {
			if(item.includes("/") && !item.includes("HEAD")){
          
				 if(item.startsWith("origin")){

                    br.push(item.slice(7))
				 } else {
					br.push(item.slice(15))
				 }
		     }
	
	      }
		)
		}

		resolve(br)

	})

	
})
}


async function showQuickPick(avail_branch : string []){
	console.log("inside the quick pick function")
	let i = 0;
	const result = await window.showQuickPick(avail_branch, {
		placeHolder: 'Select the target branch to check the latest change',
	});


	return result

}


function fetch_all_branches(path: any) :Promise<any> {
	return new Promise((resolve, reject) => {
	let fetch_op : any
	console.log("inside the fetching")
		child_process.exec(`git  -C ${path} fetch --prune origin`, (error, stdout, stderr) => { 

		if(error){
			console.log("This is error")
			reject(error);
			return
		}

		if(stdout) {
		console.log(`stdout: ${stdout}`);

		fetch_op = stdout.toString()

		}

		resolve("fetch_completed")

	})

	
})
}


function git_diff_check(path : string, branch: string) :Promise<any> {

	return new Promise((resolve, reject) => {

	let git_diff_count : any

	console.log("Inside the Git count Difference")

		child_process.exec(`git -C ${path} rev-list --count HEAD..origin/${branch}`, (error, stdout, stderr) => { 

		if(error){
			console.log("This is error")
			reject(error);
			return
		}

		if(stdout) {
		console.log(`stdout: ${stdout}`);

		git_diff_count = stdout

		}

		resolve(git_diff_count)

	})
})
}




function git_target_base(path : string, branch: string) :Promise<any> {

	return new Promise((resolve, reject) => {

	let git_base : any

	console.log("Inside the Git target base Difference")

		child_process.exec(`git -C ${path} merge-base HEAD origin/${branch}`, (error, stdout, stderr) => { 

		if(error){
			console.log("This is error")
			reject(error);
			return
		}

		if(stdout) {
		//console.log(`stdout: ${stdout}`);

		git_base = stdout.toString().slice(0,6)

		}

		resolve(git_base)

	})
})
}


function git_merge_check(path : string, branch: string, target_base_sha : string) :Promise<any> {

	return new Promise((resolve, reject) => {

	let diff_number : any

	console.log("Inside the Git Branch Difference")

		child_process.exec(`git -C ${path} merge-tree ${target_base_sha} HEAD origin/${branch}`, (error, stdout, stderr) => { 

		if(error){
			console.log("This is error")
			reject(error);
			return
		}

		if(stdout) {
		//console.log(`stdout: ${stdout}`);

		diff_number = stdout.toString()

		}

		resolve(diff_number)

	})
})
}