import Vue from 'vue'
import { normalizeMap, resolveSource } from './utils'

export default (
  { state, mutations = {}, actions = {}, plugins, subscribers = [] } = {}
) => {
  const vm = new Vue({
    data: {
      $$state: typeof state === 'function' ? state() : state
    }
  })

  const store = {
    state: vm.$data.$$state,
    mutations,
    actions,
    subscribers,
    subscribe: sub => {
      store.subscribers.push(sub)
      return () => store.subscribers.splice(store.subscribers.indexOf(sub), 1)
    },
    commit(type, payload) {
      for (const sub of store.subscribers) {
        sub({ type, payload }, store.state)
      }
      const mutation = resolveSource(mutations, type)
      return mutation && mutation(store.state, payload)
    },
    dispatch(type, payload) {
      const action = resolveSource(actions, type)
      return Promise.resolve(action && action(store, payload))
    },
    use: fn => fn(store)
  }

  store.mapState = states => {
    const res = {}
    for (const { k, v } of normalizeMap(states)) {
      res[k] = function() {
        return typeof v === 'function'
          ? v.call(this, store.state)
          : store.state[v]
      }
    }
    return res
  }

  const mapToMethods = (source, run) => map => {
    const res = {}
    for (const { k, v } of normalizeMap(map)) {
      res[k] = function(payload) {
        const actualSource = typeof v === 'function' ? v.call(this, source) : v
        return run(actualSource, payload)
      }
    }
    return res
  }

  store.mapMutations = mapToMethods(store.mutations, store.commit)
  store.mapActions = mapToMethods(store.actions, store.dispatch)

  plugins && plugins.forEach(p => store.use(p))

  return store
}
