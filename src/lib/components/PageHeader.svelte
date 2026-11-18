<script lang="ts">
	import type { Snippet } from 'svelte';

	let { eyebrow, title, children }: { eyebrow: string; title: string; children?: Snippet } =
		$props();
</script>

<header id="topbar" class="flex flex-wrap items-center justify-between gap-4">
	<div class="flex flex-col gap-1">
		<p class="eyebrow">{eyebrow}</p>
		<h1 class="text-[28px] font-semibold tracking-tight">{title}</h1>
	</div>
	{@render children?.()}
</header>
