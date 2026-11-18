<script lang="ts">
	import { goto } from '$app/navigation';
	import EntryForm from '$lib/components/EntryForm.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head><title>tracky · Eintrag nachtragen</title></svelte:head>

<div class="mx-auto flex max-w-[540px] flex-col rounded-2xl bg-surface">
	<EntryForm
		{data}
		onDateChange={(date) =>
			goto(`?date=${date}`, { replaceState: true, noScroll: true, keepFocus: true })}
		onClose={() => goto('/')}
		onSaved={() => goto('/')}
	/>
</div>
