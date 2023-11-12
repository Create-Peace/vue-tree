import TreeData from './TreeData'
import TreeNode from './TreeNode'
import VirtualTreeList from './VirtualTreeList'
import GenTree from './GenTree'
import { addClass, findNearestComponent, removeClass } from '../../utils/assist'
import './styles/index.less'

const prefixClass = 'vue-tree'

export default {
  name: 'VueTree',
  components: {
    TreeNode
  },
  mixins: [GenTree],
  props: {
    expandedAll: {
      type: Boolean,
      default: false
    },
    checkStrictly: {
      type: Boolean,
      default: false
    },
    draggable: {
      type: Boolean,
      default: false
    },
    renderTreeNode: {
      type: Function
    },
    searchVal: {
      type: String
    },
    hasHalfelEction: {
      type: Boolean
    },
    icon: {
      type: String,
      default: 'icon-down'
    },
    showCheckbox: {
      type: Boolean,
      default: false
    },
    treeData: {
      type: Array,
      default: () => {
        return []
      }
    },
    level: {
      type: Number,
      default: 0
    },
    lazy: [Boolean],
    load: [Function],
    multiple: [Boolean],
    immediatelyLoad: [Boolean],
    isEditOption: [Boolean],
    virtual: [Boolean],
    isLoading: [Boolean],
    checkedValue: [Number, String, Array]
  },
  data () {
    return {
      hasSearchResult: false,
      dataMap: {},
      prefixClass,
      root: {},
      dragInfo: {
        showDropIndicator: false,
        draggingNode: null,
        dropNode: null,
        allowDrop: true,
        isInitData: false
      },
      activatedNode: {},
      checkedNodes: [],
      checkedNodeKeys: [],
      isSearchingAddNode: {},
      flatTreeNodes: [],
      nodeMap: {},
      syncSelectData: true
    }
  },
  created () {
    if (this.lazy && this.immediatelyLoad) {
      if (!this.load) {
        throw new Error('[Tree] when lazy is true, load method must be set')
      }
      this.load(this.root, data => {
        const dataOrr = {
          children: data,
          id: 'root',
          expanded: true
        }
        this.root = this.generateTree(dataOrr, { expanded: !this.lazy && this.expandedAll })
        this.initData()
      })
    }
  },
  computed: {
    localeNotFoundText () {
      if (typeof this.notFoundText === 'undefined') {
        return '无匹配数据'
      } else {
        return this.notFoundText
      }
    },
    isNoData () {
      return (this.searchVal && !this.hasSearchResult) || (!this.isLoading && (!this.root.children || !this.root.children.length))
    }
  },
  watch: {
    searchVal: {
      handler: function (newVal, oldVal) {
        if (newVal !== oldVal) {
          this.filter(newVal)
        }
      }
    },
    treeData: {
      handler () {
        const dataOrr = {
          children: this.treeData,
          id: 'root',
          expanded: true
        }
        this.root = this.generateTree(dataOrr, { expanded: !this.lazy && this.expandedAll }) // 懒加载时 默认全部展开失效
        this.initData()
        if (this.virtual) {
          this.getFlatTree()
        }
      },
      immediate: true
    }
  },
  methods: {
    getFlatTree () {
      this.flatTreeNodes = this.genFlatTree(this.root)
    },
    removeChild (node) {
      Object.assign(node.data, { checked: false, selected: false })
      if (this.showCheckbox) {
        this.refreshNode(node)
      }
      node.parent.removeChild(node)
      this.initData()
    },
    appendChild (nodeData, parent) {
      const treeNode = new TreeData({ ...nodeData, expanded: this.expandedAll }) // TODO this.expandedAll 是不是应该去掉
      this.nodeMap[nodeData.id] = treeNode
      parent.addChild(treeNode)
      this.refreshDown(parent)
    },
    // 给手动添加的条目 在root 节点上添加
    prependChild (nodeData, parent) {
      if (nodeData instanceof TreeData) {
        parent.prependChild(nodeData)
        return
      }
      const treeNode = new TreeData({ ...nodeData, expanded: this.expandedAll }) // TODO this.expandedAll 是不是应该去掉
      this.nodeMap[nodeData.id] = treeNode
      parent.prependChild(treeNode)
    },
    appendChildren (children, parent) {
      children && children.forEach(child => {
        this.appendChild(child, parent)
      })
    },
    filter (keyWord) {
      this.hasSearchResult = false
      const walk = (node = this.root) => {
        const { parent, children } = node
        children && children.forEach(child => {
          if (!keyWord) {
            Object.assign(child.data, { visible: !parent })
            walk(child)
            return
          }
          if (child.data && child.data.name && (child.data.name.includes(keyWord))) {
            if (!this.hasSearchResult) {
              this.hasSearchResult = true
            }
            Object.assign(child.data, { visible: true, expanded: !this.lazy || (child.children && child.children.length) })
            this.refreshDownVisible(child)
            this.refreshUpVisible(child)
          } else {
            Object.assign(child.data, { visible: false })
            walk(child)
          }
        })
      }
      walk()
    },
    refreshDownVisible (node) {
      const { children } = node
      children && children.forEach((child) => {
        Object.assign(child.data, {
          visible: true,
          expanded: true
        })
        this.refreshDownVisible(child)
      })
    },
    refreshUpVisible (node) {
      const { parent } = node
      if (!parent) return
      Object.assign(parent.data, {
        visible: true,
        expanded: true
      })
      this.refreshUpVisible(parent)
    },
    clear () {
      const checkedNodes = []
      const removeNodes = []
      this.checkedNodes.forEach(node => {
        if (!node.disabled) {
          Object.assign(node, { checked: false, selected: false })
          const treeNode = this.nodeMap[node.id]
          removeNodes.push(treeNode)
        } else {
          checkedNodes.push(node)
        }
      })
      if (this.showCheckbox && !this.checkStrictly) {
        removeNodes.forEach(node => {
          this.refreshNode(node)
        })
      }
      this.checkedNodes = checkedNodes
    },
    setCheckedNodeKeys (values) {
      if (Array.isArray(values)) {
        values.forEach(val => {
          this.setNodeValue(val)
        })
      } else {
        this.setNodeValue(values)
      }
      this.updateSelectValue()
    },
    updateSelectValue () {
      // 向select 更新数据
      this.$nextTick(() => {
        if (this.showCheckbox) {
          this.$emit('on-checked-change', { selectedData: this.checkedNodes })
        } else {
          this.checkedNodes.forEach(node => {
            this.$emit('on-selected-change', node)
          })
        }
      })
    },
    setNodeValue (val) {
      const node = this.nodeMap[val]
      if (!node) return
      if (this.showCheckbox) {
        Object.assign(node.data, { checked: true })
        this.refreshNode(node)
      } else if (this.multiple) {
        Object.assign(node.data, { selected: true })
        this.checkedNodes.push(node.data)
      } else {
        Object.assign(node.data, { selected: true })
        this.checkedNodes = [node.data]
      }
    },
    removeCheckedNode (node, index) {
      Object.assign(node, { checked: false, selected: false })
      this.checkedNodes.splice(index, 1)
    },
    getCheckedNodes () {
      return this.checkedNodes
    },
    initData () {
      this.recurTree(this.root)
      if (this.syncSelectData && this.treeData && this.treeData.length && this.checkedValue) {
        this.syncSelectData = false
        this.updateSelectValue()
      }
    },
    recurTree (node) {
      if (node.isSelected() || node.isChecked() || (this.hasHalfelEction && node.isPartialSelected())) {
        if (this.checkStrictly || !this.showCheckbox) {
          this.getCheckedValue(node)
        } else {
          this.refreshNode(node) //  现在改为了 先下刷新 再向上刷新
        }
      } else {
        node.children && node.children.forEach((child) => this.recurTree(child))
      }
    },
    refreshExpandedDown (node) {
      const { children } = node
      const expanded = node.isExpanded()
      children && children.forEach((child) => {
        Object.assign(child.data, { expanded })
        this.refreshExpandedDown(child)
      })
    },
    getCheckedValue (node) {
      if (!node.data || !node.data.id) return
      const index = this.checkedNodes.findIndex(item => item === node.data)
      if (node.isChecked() || (!this.showCheckbox && node.isSelected()) || (this.hasHalfelEction && node.isPartialSelected())) {
        if (index < 0) {
          this.nodeMap[node.data.id] = node
          this.checkedNodes.push(node.data)
        } else {
          this.checkedNodes.splice(index, 1, node.data)
        }
      } else if (index >= 0) { // 当前的节点 !(选中 || 半选) && exist
        this.checkedNodes.splice(index, 1)
      }
    },
    refreshUp (node) {
      const { parent } = node
      this.getCheckedValue(node)
      if (!parent || parent.data.id === 'root') return
      const toState = parent.isAllChildrenSelected()

      const partialSelected = !toState && parent.hasChildrenPartialSelected()
      const exceptDisabledChecked = parent.isExceptDisabledChecked()
      Object.assign(parent.data, {
        checked: toState,
        partialSelected,
        exceptDisabledChecked
      })
      this.refreshUp(parent)
    },
    refreshNode (node) {
      // eslint-disable-next-line no-debugger
      // debugger
      this.refreshDown(node)
    },
    refreshDown (node) {
      const { children } = node

      if (!children || !children.length) {
        this.refreshUp(node)
        return
      }
      const toState = node.isChecked()
      children && children.forEach((child) => {
        if (!child.data.disabled) {
          Object.assign(child.data, {
            checked: toState,
            partialSelected: false,
            exceptDisabledChecked: toState
          })
        }
        // const fromState = child.isChecked() // 状态一致不向下刷新
        // if (fromState === toState) {
        //   return
        // }
        this.getCheckedValue(child)
        this.refreshDown(child)
      })
    },
    handleDrop (event) {
      event.stopPropagation()
    },
    handleClickNode (treeNode) {
      if (!this.showCheckbox) {
        this.nodeMap[treeNode.node.data.id] = treeNode.node
        if (this.multiple) {
          Object.assign(treeNode.node.data, { selected: !treeNode.node.data.selected })
          const index = this.checkedNodes.findIndex(checkedNode => checkedNode === treeNode.node.data)
          if (index < 0) {
            this.checkedNodes.push(treeNode.node.data)
          } else {
            this.checkedNodes.splice(index, 1)
          }
        } else {
          if (this.checkedNodes && this.checkedNodes.length) {
            const oldActivatedNode = this.checkedNodes[0]
            Object.assign(this.nodeMap[oldActivatedNode.id].data, { selected: false })
            this.checkedNodes = []
          }
          Object.assign(treeNode.node.data, { selected: true })
          this.getCheckedValue(treeNode.node)
        }
      }
      this.activatedNode = treeNode.node
      this.$emit('on-selected-change', treeNode.node.data)
    },
    dragStart (event, treeNode) {
      event.stopPropagation()
      if (
        typeof this.allowDrag === 'function' &&
        !this.allowDrag(treeNode.node)
      ) {
        event.preventDefault()
        return false
      }
      event.dataTransfer.effectAllowed = 'move'

      // wrap in try catch to address IE's error when first param is 'text/plain'
      try {
        // setData is required for draggable to work in FireFox
        // the content has to be '' so dragging a node out of the tree won't open a new tab in FireFox
        event.dataTransfer.setData('text/plain', '')
      } catch (e) {
        console.error(e)
      }
      this.dragInfo.draggingNode = treeNode
      this.$emit('node-drag-start', treeNode.node, event)
    },
    dragOver (event) {
      event.stopPropagation()
      const dragInfo = this.dragInfo
      const dropNode = findNearestComponent(event.target, 'TreeNode')
      const oldDropNode = dragInfo.dropNode
      if (oldDropNode && oldDropNode !== dropNode) {
        removeClass(oldDropNode.$el, 'is-drop-inner')
      }
      const draggingNode = dragInfo.draggingNode
      if (!draggingNode || !dropNode) return

      let dropPrev = true
      let dropInner = true
      let dropNext = true
      let userAllowDropInner = true
      if (typeof this.allowDrop === 'function') {
        dropPrev = this.allowDrop(draggingNode.node, dropNode.node, 'prev')
        userAllowDropInner = dropInner = this.allowDrop(
          draggingNode.node,
          dropNode.node,
          'inner'
        )
        dropNext = this.allowDrop(draggingNode.node, dropNode.node, 'next')
      }
      event.dataTransfer.dropEffect = dropInner ? 'move' : 'none'
      if ((dropPrev || dropInner || dropNext) && oldDropNode !== dropNode) {
        if (oldDropNode) {
          this.$emit(
            'node-drag-leave',
            draggingNode.node,
            oldDropNode.node,
            event
          )
        }
        this.$emit('node-drag-enter', draggingNode.node, dropNode.node, event)
      }

      if (dropPrev || dropInner || dropNext) {
        dragInfo.dropNode = dropNode
      }
      if (dropNode.node.nextSibling === draggingNode.node) {
        dropNext = false
      }
      if (dropNode.node.previousSibling === draggingNode.node) {
        dropPrev = false
      }
      if (dropNode.node.contains(draggingNode.node, false)) {
        dropInner = false
      }
      if (
        draggingNode.node === dropNode.node ||
        draggingNode.node.contains(dropNode.node)
      ) {
        dropPrev = false
        dropInner = false
        dropNext = false
      }

      const targetPosition = dropNode.$el.getBoundingClientRect()
      const treePosition = this.$el.getBoundingClientRect()

      let dropType
      const prevPercent = dropPrev
        ? dropInner
          ? 0.25
          : dropNext
            ? 0.45
            : 1
        : -1
      const nextPercent = dropNext
        ? dropInner
          ? 0.75
          : dropPrev
            ? 0.55
            : 0
        : 1

      let indicatorTop = -9999
      const distance = event.clientY - targetPosition.top
      if (distance < targetPosition.height * prevPercent) {
        dropType = 'before'
      } else if (distance > targetPosition.height * nextPercent) {
        dropType = 'after'
      } else if (dropInner) {
        dropType = 'inner'
      } else {
        dropType = 'none'
      }

      const iconPosition = dropNode.$el
        .querySelector('.expand_box')
        .getBoundingClientRect()
      const dropIndicator = this.$refs.dropIndicator
      if (dropType === 'before') {
        indicatorTop = iconPosition.top - treePosition.top
      } else if (dropType === 'after') {
        indicatorTop = iconPosition.bottom - treePosition.top
      }
      dropIndicator.style.top = indicatorTop + 'px'
      dropIndicator.style.left = iconPosition.right - treePosition.left + 'px'

      if (dropType === 'inner') {
        addClass(dropNode.$el, 'is-drop-inner')
      } else {
        removeClass(dropNode.$el, 'is-drop-inner')
      }

      dragInfo.showDropIndicator =
        dropType === 'before' || dropType === 'after'
      dragInfo.allowDrop = dragInfo.showDropIndicator || userAllowDropInner
      dragInfo.dropType = dropType
      this.$emit('node-drag-over', draggingNode.node, dropNode.node, event)
    },
    dragEnd (event) {
      event.stopPropagation()
      const dragInfo = this.dragInfo
      const { draggingNode, dropType, dropNode } = dragInfo
      event.preventDefault()
      event.dataTransfer.dropEffect = 'move'

      if (draggingNode && dropNode) {
        const draggingNodeCopy = draggingNode.node
        if (dropType !== 'none') {
          draggingNode.node.remove()
        }
        if (dropType === 'before') {
          dropNode.node.parent.insertBefore(draggingNodeCopy, dropNode.node)
        } else if (dropType === 'after') {
          dropNode.node.parent.insertAfter(draggingNodeCopy, dropNode.node)
        } else if (dropType === 'inner') {
          dropNode.node.insertChild(draggingNodeCopy)
        }
        removeClass(dropNode.$el, 'is-drop-inner')
        this.$emit(
          'node-drag-end',
          draggingNode.node,
          dropNode.node,
          dropType,
          event
        )
        this.$emit('on-drop', {
          parentNode: dropNode,
          targetNode: draggingNode.node,
          callback: () => {} // 兼容之前api
        })
        if (dropType !== 'none') {
          this.$emit(
            'node-drop',
            draggingNode.node,
            dropNode.node,
            dropType,
            event
          )
        }
      }
      if (draggingNode && !dropNode) {
        this.$emit('node-drag-end', draggingNode.node, null, dropType, event)
        this.$emit('on-drop', { // 兼容之前api
          parentNode: dropNode,
          targetNode: draggingNode.node,
          callback: () => {}
        })
      }

      dragInfo.showDropIndicator = false
      dragInfo.draggingNode = null
      dragInfo.dropNode = null
      dragInfo.allowDrop = true
      this.initData()
    },
    renderVirtualTree (treeNodes) {
      return (
        <VirtualTreeList tree={this} treeNodes={treeNodes} {...{ props: this.$attrs }} />
      )
    },
    renderNormalTree (children) {
      return (
        children && children.map(childNode => {
          return childNode.data.visible && <TreeNode tree={this} node={childNode} />
        })
      )
    }
  },
  render () {
    const { children } = this.root
    const { localeNotFoundText, isNoData, flatTreeNodes, virtual, renderNormalTree, renderVirtualTree } = this
    const treeNodes = this.virtual ? flatTreeNodes : children
    const { showDropIndicator = false } = this.dragInfo
    return (
      <div class={prefixClass} >
        {
          virtual ? renderVirtualTree(treeNodes) : renderNormalTree(treeNodes)
        }
        <div style={{ display: isNoData ? 'block' : 'none' }}>
          <ul class={`${prefixClass}-not-found`}>
            <li>{ localeNotFoundText }</li>
          </ul>
        </div>
        <div
          ref="dropIndicator"
          class="drop-indicator"
          style={{ display: showDropIndicator ? 'block' : 'none' }}></div>
      </div>
    )
  }
}
