<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { changeEntrySheetDate } from '$lib/entry-sheet';
	import EntryForm from './EntryForm.svelte';
	import type { PageData } from '../../routes/entry/$types';

	let { data }: { data: PageData } = $props();

	let dialog: HTMLDialogElement;
	$effect(() => {
		dialog.showModal();
	});

	const close = () => history.back();
</script>

<!-- Side sheet on desktop, bottom sheet on phones. Native <dialog> handles focus and Esc. -->
<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
<dialog
	bind:this={dialog}
	aria-labelledby="entry-sheet-title"
	oncancel={(e) => {
		e.preventDefault();
		close();
	}}
	onclick={(e) => {
		if (e.target === dialog) close();
	}}
	class="m-0 mt-auto max-h-[92dvh] w-full max-w-none overflow-hidden rounded-t-3xl border-t border-line bg-surface text-fg shadow-[0_-20px_60px_#00000099] transition-transform duration-300 ease-out backdrop:bg-black/60 backdrop:backdrop-blur-[2px] motion-reduce:transition-none sm:mt-0 sm:ml-auto sm:h-dvh sm:max-h-none sm:w-[540px] sm:rounded-none sm:border-t-0 sm:border-l sm:shadow-[-20px_0_60px_#00000099] starting:translate-y-full sm:starting:translate-x-full sm:starting:translate-y-0"
>
	<div class="flex h-full max-h-[92dvh] flex-col sm:max-h-none">
		<div class="flex justify-center pt-2.5 sm:hidden" aria-hidden="true">
			<span class="h-1 w-10 rounded-full bg-line-strong"></span>
		</div>
		<EntryForm
			{data}
			onDateChange={(date) => changeEntrySheetDate(date, data.editing?.id)}
			onClose={close}
			onSaved={async () => {
				close();
				await invalidateAll();
			}}
		/>
	</div>
</dialog>
