/**
 * Reactive `matchMedia`. False during SSR and until mounted, so the server
 * and first client render agree; layout differences should come from CSS,
 * this is only for behaviour (e.g. panel vs bottom sheet). Keep queries in
 * step with Tailwind's breakpoints (lg = 1024px) so JS and CSS agree.
 */
export function useMediaQuery(query: string) {
  const matches = ref(false)
  let mql: MediaQueryList | undefined
  const update = () => { matches.value = !!mql?.matches }

  onMounted(() => {
    mql = window.matchMedia(query)
    update()
    mql.addEventListener('change', update)
  })
  onBeforeUnmount(() => mql?.removeEventListener('change', update))

  return readonly(matches)
}
