(function() {
    d3.layout = {};
    // Implements hierarchical edge bundling using Holten's algorithm. For each
    // input link, a path is computed that travels through the tree, up the parent
    // hierarchy to the least common ancestor, and then back down to the destination
    // node. Each path is simply an array of nodes.
    d3.layout.bundle = function() {
        return function(links) {
            var paths = [],
                i = -1,
                n = links.length;
            while (++i < n) paths.push(d3_layout_bundlePath(links[i]));
            return paths;
        };
    };

    function d3_layout_bundlePath(link) {
        var start = link.source,
            end = link.target,
            lca = d3_layout_bundleLeastCommonAncestor(start, end),
            points = [start];
        while (start !== lca) {
            start = start.parent;
            points.push(start);
        }
        var k = points.length;
        while (end !== lca) {
            points.splice(k, 0, end);
            end = end.parent;
        }
        return points;
    }

    function d3_layout_bundleAncestors(node) {
        var ancestors = [],
            parent = node.parent;
        while (parent != null) {
            ancestors.push(node);
            node = parent;
            parent = parent.parent;
        }
        ancestors.push(node);
        return ancestors;
    }

    function d3_layout_bundleLeastCommonAncestor(a, b) {
        if (a === b) return a;
        var aNodes = d3_layout_bundleAncestors(a),
            bNodes = d3_layout_bundleAncestors(b),
            aNode = aNodes.pop(),
            bNode = bNodes.pop(),
            sharedNode = null;
        while (aNode === bNode) {
            sharedNode = aNode;
            aNode = aNodes.pop();
            bNode = bNodes.pop();
        }
        return sharedNode;
    }

    var d3_layout_forceDragForce,
        d3_layout_forceDragNode;

    function d3_layout_forceDragOver(d) {
        d.fixed |= 2;
    }

    function d3_layout_forceDragOut(d) {
        if (d !== d3_layout_forceDragNode) d.fixed &= 1;
    }

    function d3_layout_forceDragEnd() {
        d3_layout_forceDrag();
        d3_layout_forceDragNode.fixed &= 1;
        d3_layout_forceDragForce = d3_layout_forceDragNode = null;
    }

    function d3_layout_forceDrag() {
        d3_layout_forceDragNode.px += d3.event.dx;
        d3_layout_forceDragNode.py += d3.event.dy;
        d3_layout_forceDragForce.resume(); // restart annealing
    }

    function d3_layout_forceAccumulate(quad, alpha, charges) {
        var cx = 0,
            cy = 0;
        quad.charge = 0;
        if (!quad.leaf) {
            var nodes = quad.nodes,
                n = nodes.length,
                i = -1,
                c;
            while (++i < n) {
                c = nodes[i];
                if (c == null) continue;
                d3_layout_forceAccumulate(c, alpha, charges);
                quad.charge += c.charge;
                cx += c.charge * c.cx;
                cy += c.charge * c.cy;
            }
        }
        if (quad.point) {
            // jitter internal nodes that are coincident
            if (!quad.leaf) {
                quad.point.x += Math.random() - .5;
                quad.point.y += Math.random() - .5;
            }
            var k = alpha * charges[quad.point.index];
            quad.charge += quad.pointCharge = k;
            cx += k * quad.point.x;
            cy += k * quad.point.y;
        }
        quad.cx = cx / quad.charge;
        quad.cy = cy / quad.charge;
    }

    function d3_layout_forceLinkDistance(link) {
        return 20;
    }

    function d3_layout_forceLinkStrength(link) {
        return 1;
    }
    function d3_layout_stackMaxIndex(array) {
        var i = 1,
            j = 0,
            v = array[0][1],
            k,
            n = array.length;
        for (; i < n; ++i) {
            if ((k = array[i][1]) > v) {
                j = i;
                v = k;
            }
        }
        return j;
    }

    function d3_layout_stackReduceSum(d) {
        return d.reduce(d3_layout_stackSum, 0);
    }

    function d3_layout_stackSum(p, d) {
        return p + d[1];
    }

    function d3_layout_histogramBinSturges(range, values) {
        return d3_layout_histogramBinFixed(range, Math.ceil(Math.log(values.length) / Math.LN2 + 1));
    }

    function d3_layout_histogramBinFixed(range, n) {
        var x = -1,
            b = +range[0],
            m = (range[1] - b) / n,
            f = [];
        while (++x <= n) f[x] = m * x + b;
        return f;
    }

    function d3_layout_histogramRange(values) {
        return [d3.min(values), d3.max(values)];
    }
    d3.layout.hierarchy = function() {
        console.log('d3.layout.hierarchy');
        var sort = d3_layout_hierarchySort,
            children = d3_layout_hierarchyChildren,
            value = d3_layout_hierarchyValue;

        // Recursively compute the node depth and value.
        // Also converts the data representation into a standard hierarchy structure.
        function recurse(data, depth, nodes) {
            var childs = children.call(hierarchy, data, depth),
                node = d3_layout_hierarchyInline ? data : {
                    data: data
                };
            node.depth = depth;
            nodes.push(node);
            if (childs && (n = childs.length)) {
                var i = -1,
                    n,
                    c = node.children = [],
                    v = 0,
                    j = depth + 1;
                while (++i < n) {
                    d = recurse(childs[i], j, nodes);
                    d.parent = node;
                    c.push(d);
                    v += d.value;
                }
                if (sort) c.sort(sort);
                if (value) node.value = v;
            } else if (value) {
                node.value = +value.call(hierarchy, data, depth) || 0;
            }
            return node;
        }

        // Recursively re-evaluates the node value.
        function revalue(node, depth) {
            var children = node.children,
                v = 0;
            if (children && (n = children.length)) {
                var i = -1,
                    n,
                    j = depth + 1;
                while (++i < n) v += revalue(children[i], j);
            } else if (value) {
                v = +value.call(hierarchy, d3_layout_hierarchyInline ? node : node.data, depth) || 0;
            }
            if (value) node.value = v;
            return v;
        }

        function hierarchy(d) {
            var nodes = [];
            recurse(d, 0, nodes);
            return nodes;
        }

        hierarchy.sort = function(x) {
            if (!arguments.length) return sort;
            sort = x;
            return hierarchy;
        };

        hierarchy.children = function(x) {
            if (!arguments.length) return children;
            children = x;
            return hierarchy;
        };

        hierarchy.value = function(x) {
            if (!arguments.length) return value;
            value = x;
            return hierarchy;
        };

        // Re-evaluates the `value` property for the specified hierarchy.
        hierarchy.revalue = function(root) {
            revalue(root, 0);
            return root;
        };

        return hierarchy;
    };

    // A method assignment helper for hierarchy subclasses.
    function d3_layout_hierarchyRebind(object, hierarchy) {
        object.sort = d3.rebind(object, hierarchy.sort);
        object.children = d3.rebind(object, hierarchy.children);
        object.links = d3_layout_hierarchyLinks;
        object.value = d3.rebind(object, hierarchy.value);

        // If the new API is used, enabling inlining.
        object.nodes = function(d) {
            d3_layout_hierarchyInline = true;
            return (object.nodes = object)(d);
        };

        return object;
    }

    function d3_layout_hierarchyChildren(d) {
        return d.children;
    }

    function d3_layout_hierarchyValue(d) {
        return d.value;
    }

    function d3_layout_hierarchySort(a, b) {
        return b.value - a.value;
    }

    // Returns an array source+target objects for the specified nodes.
    function d3_layout_hierarchyLinks(nodes) {
        return d3.merge(nodes.map(function(parent) {
            return (parent.children || []).map(function(child) {
                return {
                    source: parent,
                    target: child
                };
            });
        }));
    }

    // For backwards-compatibility, don't enable inlining by default.
    var d3_layout_hierarchyInline = false;

    function d3_layout_packSort(a, b) {
        return a.value - b.value;
    }

    function d3_layout_packInsert(a, b) {
        var c = a._pack_next;
        a._pack_next = b;
        b._pack_prev = a;
        b._pack_next = c;
        c._pack_prev = b;
    }

    function d3_layout_packSplice(a, b) {
        a._pack_next = b;
        b._pack_prev = a;
    }

    function d3_layout_packIntersects(a, b) {
        var dx = b.x - a.x,
            dy = b.y - a.y,
            dr = a.r + b.r;
        return (dr * dr - dx * dx - dy * dy) > .001; // within epsilon
    }

    function d3_layout_packLink(node) {
        node._pack_next = node._pack_prev = node;
    }

    function d3_layout_packUnlink(node) {
        delete node._pack_next;
        delete node._pack_prev;
    }

    function d3_layout_packTree(node) {
        var children = node.children;
        if (children && children.length) {
            children.forEach(d3_layout_packTree);
            node.r = d3_layout_packCircle(children);
        } else {
            node.r = Math.sqrt(node.value);
        }
    }

    function d3_layout_packTransform(node, x, y, k) {
        var children = node.children;
        node.x = (x += k * node.x);
        node.y = (y += k * node.y);
        node.r *= k;
        if (children) {
            var i = -1,
                n = children.length;
            while (++i < n) d3_layout_packTransform(children[i], x, y, k);
        }
    }

    function d3_layout_packPlace(a, b, c) {
        var db = a.r + c.r,
            dx = b.x - a.x,
            dy = b.y - a.y;
        if (db && (dx || dy)) {
            var da = b.r + c.r,
                dc = Math.sqrt(dx * dx + dy * dy),
                cos = Math.max(-1, Math.min(1, (db * db + dc * dc - da * da) / (2 * db * dc))),
                theta = Math.acos(cos),
                x = cos * (db /= dc),
                y = Math.sin(theta) * db;
            c.x = a.x + x * dx + y * dy;
            c.y = a.y + x * dy - y * dx;
        } else {
            c.x = a.x + db;
            c.y = a.y;
        }
    }

    function d3_layout_clusterY(children) {
        return 1 + d3.max(children, function(child) {
            return child.y;
        });
    }

    function d3_layout_clusterX(children) {
        return children.reduce(function(x, child) {
            return x + child.x;
        }, 0) / children.length;
    }

    function d3_layout_clusterLeft(node) {
        var children = node.children;
        return children && children.length ? d3_layout_clusterLeft(children[0]) : node;
    }

    function d3_layout_clusterRight(node) {
        var children = node.children,
            n;
        return children && (n = children.length) ? d3_layout_clusterRight(children[n - 1]) : node;
    }
    // Node-link tree diagram using the Reingold-Tilford "tidy" algorithm
    d3.layout.tree = function() {
        console.log('d3.layout.tree');
        var hierarchy = d3.layout.hierarchy().sort(null).value(null),
            separation = d3_layout_treeSeparation,
            size = [1, 1]; // width, height

        function tree(d, i) {
            var nodes = hierarchy.call(this, d, i),
                root = nodes[0];

            function firstWalk(node, previousSibling) {
                var children = node.children,
                    layout = node._tree;
                if (children && (n = children.length)) {
                    var n,
                        firstChild = children[0],
                        previousChild,
                        ancestor = firstChild,
                        child,
                        i = -1;
                    while (++i < n) {
                        child = children[i];
                        firstWalk(child, previousChild);
                        ancestor = apportion(child, previousChild, ancestor);
                        previousChild = child;
                    }
                    d3_layout_treeShift(node);
                    var midpoint = .5 * (firstChild._tree.prelim + child._tree.prelim);
                    if (previousSibling) {
                        layout.prelim = previousSibling._tree.prelim + separation(node, previousSibling);
                        layout.mod = layout.prelim - midpoint;
                    } else {
                        layout.prelim = midpoint;
                    }
                } else {
                    if (previousSibling) {
                        layout.prelim = previousSibling._tree.prelim + separation(node, previousSibling);
                    }
                }
            }

            function secondWalk(node, x) {
                node.x = node._tree.prelim + x;
                var children = node.children;
                if (children && (n = children.length)) {
                    var i = -1,
                        n;
                    x += node._tree.mod;
                    while (++i < n) {
                        secondWalk(children[i], x);
                    }
                }
            }

            function apportion(node, previousSibling, ancestor) {
                if (previousSibling) {
                    var vip = node,
                        vop = node,
                        vim = previousSibling,
                        vom = node.parent.children[0],
                        sip = vip._tree.mod,
                        sop = vop._tree.mod,
                        sim = vim._tree.mod,
                        som = vom._tree.mod,
                        shift;
                    while (vim = d3_layout_treeRight(vim), vip = d3_layout_treeLeft(vip), vim && vip) {
                        vom = d3_layout_treeLeft(vom);
                        vop = d3_layout_treeRight(vop);
                        vop._tree.ancestor = node;
                        shift = vim._tree.prelim + sim - vip._tree.prelim - sip + separation(vim, vip);
                        if (shift > 0) {
                            d3_layout_treeMove(d3_layout_treeAncestor(vim, node, ancestor), node, shift);
                            sip += shift;
                            sop += shift;
                        }
                        sim += vim._tree.mod;
                        sip += vip._tree.mod;
                        som += vom._tree.mod;
                        sop += vop._tree.mod;
                    }
                    if (vim && !d3_layout_treeRight(vop)) {
                        vop._tree.thread = vim;
                        vop._tree.mod += sim - sop;
                    }
                    if (vip && !d3_layout_treeLeft(vom)) {
                        vom._tree.thread = vip;
                        vom._tree.mod += sip - som;
                        ancestor = node;
                    }
                }
                return ancestor;
            }

            // Initialize temporary layout variables.
            d3_layout_treeVisitAfter(root, function(node, previousSibling) {
                node._tree = {
                    ancestor: node,
                    prelim: 0,
                    mod: 0,
                    change: 0,
                    shift: 0,
                    number: previousSibling ? previousSibling._tree.number + 1 : 0
                };
            });

            // Compute the layout using Buchheim et al.'s algorithm.
            firstWalk(root);
            secondWalk(root, -root._tree.prelim);

            // Compute the left-most, right-most, and depth-most nodes for extents.
            var left = d3_layout_treeSearch(root, d3_layout_treeLeftmost),
                right = d3_layout_treeSearch(root, d3_layout_treeRightmost),
                deep = d3_layout_treeSearch(root, d3_layout_treeDeepest),
                x0 = left.x - separation(left, right) / 2,
                x1 = right.x + separation(right, left) / 2,
                y1 = deep.depth || 1;

            // Clear temporary layout variables; transform x and y.
            d3_layout_treeVisitAfter(root, function(node) {
                node.x = (node.x - x0) / (x1 - x0) * size[0];
                node.y = node.depth / y1 * size[1];
                delete node._tree;
            });

            return nodes;
        }

        tree.separation = function(x) {
            if (!arguments.length) return separation;
            separation = x;
            return tree;
        };

        tree.size = function(x) {
            if (!arguments.length) return size;
            size = x;
            return tree;
        };

        return d3_layout_hierarchyRebind(tree, hierarchy);
    };

    function d3_layout_treeSeparation(a, b) {
        return a.parent == b.parent ? 1 : 2;
    }

    // function d3_layout_treeSeparationRadial(a, b) {
    //   return (a.parent == b.parent ? 1 : 2) / a.depth;
    // }

    function d3_layout_treeLeft(node) {
        var children = node.children;
        return children && children.length ? children[0] : node._tree.thread;
    }

    function d3_layout_treeRight(node) {
        var children = node.children,
            n;
        return children && (n = children.length) ? children[n - 1] : node._tree.thread;
    }

    function d3_layout_treeSearch(node, compare) {
        var children = node.children;
        if (children && (n = children.length)) {
            var child,
                n,
                i = -1;
            while (++i < n) {
                if (compare(child = d3_layout_treeSearch(children[i], compare), node) > 0) {
                    node = child;
                }
            }
        }
        return node;
    }

    function d3_layout_treeRightmost(a, b) {
        return a.x - b.x;
    }

    function d3_layout_treeLeftmost(a, b) {
        return b.x - a.x;
    }

    function d3_layout_treeDeepest(a, b) {
        return a.depth - b.depth;
    }

    function d3_layout_treeVisitAfter(node, callback) {
        function visit(node, previousSibling) {
            var children = node.children;
            if (children && (n = children.length)) {
                var child,
                    previousChild = null,
                    i = -1,
                    n;
                while (++i < n) {
                    child = children[i];
                    visit(child, previousChild);
                    previousChild = child;
                }
            }
            callback(node, previousSibling);
        }
        visit(node, null);
    }

    function d3_layout_treeShift(node) {
        var shift = 0,
            change = 0,
            children = node.children,
            i = children.length,
            child;
        while (--i >= 0) {
            child = children[i]._tree;
            child.prelim += shift;
            child.mod += shift;
            shift += child.shift + (change += child.change);
        }
    }

    function d3_layout_treeMove(ancestor, node, shift) {
        ancestor = ancestor._tree;
        node = node._tree;
        var change = shift / (node.number - ancestor.number);
        ancestor.change += change;
        node.change -= change;
        node.shift += shift;
        node.prelim += shift;
        node.mod += shift;
    }

    function d3_layout_treeAncestor(vim, node, ancestor) {
        return vim._tree.ancestor.parent == node.parent ?
            vim._tree.ancestor :
            ancestor;
    }
})();
