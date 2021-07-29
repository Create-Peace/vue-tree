import TreeData from './TreeData'

const generateNode = (data, props) => {
  const { children, ...rest } = data;
  const node = new TreeData({ ...rest, ...props });
  children.forEach((child) => {
    // eslint-disable-next-line no-debugger
    node.addChild(generateNode(child, props));
  });
  return node;
};

import TreeNode from "./TreeNode";
import { addClass, findNearestComponent, removeClass } from "../utils/assist";

export default {
  name: "Tree",
  components: {
    TreeNode,
  },
  props: {
    expandedAll: {
      type: Boolean,
      default: true,
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
    }
  },
  data() {
    const dataOrr = {
      children: this.treeData
    }

    return {
      // isTree: true,
      dataMap: {},
      root: generateNode(dataOrr, { expanded: this.expandedAll }),
      dragInfo: {
        showDropIndicator: false,
        draggingNode: null,
        dropNode: null,
        allowDrop: true,
        isInitData: false
      },
      checkedNodes: [],
      checkedNodeKeys: []
    }
  },
  created() {
    this.walk();
    console.log(this.checkedNodeKeys)
    console.log(this.checkedNodes)

  },
  methods: {
    walk(root = this.root) {
      const { children = [] } = root;
      children?.forEach((child) => {
        const { data } = child;
        // TODO 保存选中的值
        this.getCheckedValue(child)
        if (data.selected && !this.checkStrictly) {
          this.refreshUp(child);
          this.refreshDown(child);
        } else {
          this.walk(child);
        }
      });
      this.isInitData = true
    },
    refreshExpandedDown(node) {
      // eslint-disable-next-line no-debugger
      // debugger
      const expanded = node.isExpanded();
      node?.children.forEach((child) => {
        Object.assign(child.data, { expanded });
        this.refreshExpandedDown(child);
      });
    },
    getCheckedValue (node) {
      // eslint-disable-next-line no-debugger
      // debugger
      if (!node.data.id) return
      const index = this.checkedNodeKeys.findIndex(item => item === node.data.id)
      // eslint-disable-next-line no-debugger
      // debugger
      // 当前的节点(选中 || 半选) && notExist
      if (node.isSelected() || (this.hasHalfelEction && node.isPartialSelected())) {
        if (index < 0){
          this.checkedNodeKeys.push(node.data.id)
          this.checkedNodes.push(node.data)
        }
      } else if (index >= 0) {  // 当前的节点 !(选中 || 半选) && exist
        this.checkedNodeKeys.splice(index, 1)
        this.checkedNodes.splice(index, 1)
      }
    },
    refreshUp(node) {
      const { parent } = node
      this.getCheckedValue(node)
      if (!parent) return
      const toState = parent.isAllChildrenSelected()
      const partialSelected = !toState && parent.hasChildrenPartialSelected()
      Object.assign(parent.data, {
        selected: toState,
        partialSelected
      })
      // eslint-disable-next-line no-debugger
      // debugger
      
      this.refreshUp(parent);
    },
    refreshDown(node) {
      const toState = node.isSelected(); // 这里的名称需要换掉 nodeData 避免混淆
      node?.children.forEach((child) => {
        const fromState = child.isSelected();
        // TODO  遍历children 初始化数据  不能直接跳出
        if (fromState === toState || !this.isInitData) {
          return
        }
        
        Object.assign(child.data, {
          selected: toState,
          partialSelected: false,
        });
        this.getCheckedValue(child)
        this.refreshDown(child);
      });
    },
    handleDrop(event) {
      event.stopPropagation()
    },
    dragStart(event, treeNode) {
      console.log('dratstart')
      event.stopPropagation()
      if (
        typeof this.allowDrag === "function" &&
        !this.allowDrag(treeNode.node)
      ) {
        event.preventDefault();
        return false;
      }
      event.dataTransfer.effectAllowed = "move";

      // wrap in try catch to address IE's error when first param is 'text/plain'
      try {
        // setData is required for draggable to work in FireFox
        // the content has to be '' so dragging a node out of the tree won't open a new tab in FireFox
        event.dataTransfer.setData("text/plain", "");
      } catch (e) {
        console.error(e);
      }
      this.dragInfo.draggingNode = treeNode;
      console.log('this.dragInfo.draggingNode', this.dragInfo.draggingNode)
      this.$emit("node-drag-start", treeNode.node, event);
    },
    dragOver(event) {
      event.stopPropagation()
      const dragInfo = this.dragInfo;
      const dropNode = findNearestComponent(event.target, "TreeNode");
      const oldDropNode = dragInfo.dropNode;
      if (oldDropNode && oldDropNode !== dropNode) {
        removeClass(oldDropNode.$el, "is-drop-inner");
      }
      const draggingNode = dragInfo.draggingNode;
      if (!draggingNode || !dropNode) return;

      let dropPrev = true;
      let dropInner = true;
      let dropNext = true;
      let userAllowDropInner = true;
      if (typeof this.allowDrop === "function") {
        dropPrev = this.allowDrop(draggingNode.node, dropNode.node, "prev");
        userAllowDropInner = dropInner = this.allowDrop(
          draggingNode.node,
          dropNode.node,
          "inner"
        );
        dropNext = this.allowDrop(draggingNode.node, dropNode.node, "next");
      }
      event.dataTransfer.dropEffect = dropInner ? "move" : "none";
      if ((dropPrev || dropInner || dropNext) && oldDropNode !== dropNode) {
        if (oldDropNode) {
          this.$emit(
            "node-drag-leave",
            draggingNode.node,
            oldDropNode.node,
            event
          );
        }
        this.$emit("node-drag-enter", draggingNode.node, dropNode.node, event);
      }

      if (dropPrev || dropInner || dropNext) {
        dragInfo.dropNode = dropNode;
      }
      console.log('dropNode', dropNode)
      // TODO 这里的逻辑需要实现
      if (dropNode.node.nextSibling === draggingNode.node) {
        dropNext = false;
      }
      if (dropNode.node.previousSibling === draggingNode.node) {
        dropPrev = false;
      }
      // TODO contains  需要实现
      if (dropNode.node.contains(draggingNode.node, false)) {
        dropInner = false;
      }
      if (
        draggingNode.node === dropNode.node ||
        draggingNode.node.contains(dropNode.node)
      ) {
        dropPrev = false;
        dropInner = false;
        dropNext = false;
      }

      const targetPosition = dropNode.$el.getBoundingClientRect();
      const treePosition = this.$el.getBoundingClientRect();

      let dropType;
      const prevPercent = dropPrev
        ? dropInner
          ? 0.25
          : dropNext
          ? 0.45
          : 1
        : -1;
      const nextPercent = dropNext
        ? dropInner
          ? 0.75
          : dropPrev
          ? 0.55
          : 0
        : 1;

      let indicatorTop = -9999;
      const distance = event.clientY - targetPosition.top;
      if (distance < targetPosition.height * prevPercent) {
        dropType = "before";
      } else if (distance > targetPosition.height * nextPercent) {
        dropType = "after";
      } else if (dropInner) {
        dropType = "inner";
      } else {
        dropType = "none";
      }

      const iconPosition = dropNode.$el
        .querySelector(".sh__expand-icon")
        .getBoundingClientRect();
      const dropIndicator = this.$refs.dropIndicator;
      if (dropType === "before") {
        indicatorTop = iconPosition.top - treePosition.top;
      } else if (dropType === "after") {
        indicatorTop = iconPosition.bottom - treePosition.top;
      }
      dropIndicator.style.top = indicatorTop + "px";
      dropIndicator.style.left = iconPosition.right - treePosition.left + "px";

      if (dropType === "inner") {
        addClass(dropNode.$el, "is-drop-inner");
      } else {
        removeClass(dropNode.$el, "is-drop-inner");
      }

      dragInfo.showDropIndicator =
        dropType === "before" || dropType === "after";
      dragInfo.allowDrop = dragInfo.showDropIndicator || userAllowDropInner;
      dragInfo.dropType = dropType;
      this.$emit("node-drag-over", draggingNode.node, dropNode.node, event);
    },
    dragEnd(event) {
      event.stopPropagation()
      const dragInfo = this.dragInfo;
      const { draggingNode, dropType, dropNode } = dragInfo;
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";

      if (draggingNode && dropNode) {
        const draggingNodeCopy = { data: draggingNode.node.data };
        if (dropType !== "none") {
          draggingNode.node.remove();
        }
        if (dropType === "before") {
          dropNode.node.parent.insertBefore(draggingNodeCopy, dropNode.node);
        } else if (dropType === "after") {
          dropNode.node.parent.insertAfter(draggingNodeCopy, dropNode.node);
        } else if (dropType === "inner") {
          dropNode.node.insertChild(draggingNodeCopy);
        }
        // if (dropType !== "none") {
          // this.store.registerNode(draggingNodeCopy);
        // }

        removeClass(dropNode.$el, "is-drop-inner");

        this.$emit(
          "node-drag-end",
          draggingNode.node,
          dropNode.node,
          dropType,
          event
        );
        if (dropType !== "none") {
          this.$emit(
            "node-drop",
            draggingNode.node,
            dropNode.node,
            dropType,
            event
          );
        }
      }
      if (draggingNode && !dropNode) {
        this.$emit("node-drag-end", draggingNode.node, null, dropType, event);
      }

      dragInfo.showDropIndicator = false;
      dragInfo.draggingNode = null;
      dragInfo.dropNode = null;
      dragInfo.allowDrop = true;
    },
  },
  render() {
    return (
      <div style="text-align: left">
        {/* {this.getView(this.root, 0)} */}
        {this.root?.children?.map((node, index) => {
          return <TreeNode key={node?.data?.name ?? index} node={node} />;
        })}
        <div
        style={{display: this.dragInfo.showDropIndicator? 'none' : 'block'}}
      class="el-tree__drop-indicator"
      ref="dropIndicator"></div>
      </div>
    );
  },
};
