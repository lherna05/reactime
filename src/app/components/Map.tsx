/* eslint-disable arrow-body-style */
/* eslint-disable max-len */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
/* eslint-disable @typescript-eslint/ban-types */

import React, { useState, useEffect } from 'react';
import * as d3 from 'd3';


const Map = (props) => {
  const { viewIndex, snapshots } = props;
  
  let lastSnap: number | null = null;
  if (viewIndex < 0) lastSnap = snapshots.length - 1;
  else lastSnap = viewIndex;
  
  
  const width: number = 900;
  const height: number = 600;
  let data = snapshots[lastSnap];
  

  useEffect(() => {
    document.getElementById('canvas').innerHTML = '_'; 
    return makeChart(data);
  });

  const makeChart = React.useCallback ( (data) => {
    
    // Establish Constants
    const margin = { top: 10, right: 120, bottom: 10, left: 120 };
    const dy = 100;
    const dx = 100;
    const tree = d3.tree().nodeSize([dx, dy]);
    const diagonal = d3
      .linkHorizontal()
      .x((d) => d.y)
      .y((d) => d.x);
    const root = d3.hierarchy(data);

    // Determine descendants of root node use d.depth conditional to how many levels deep to display on first render
    root.x0 = dy / 2;
    root.y0 = 0;
    root.descendants().forEach((d, i) => {
      d.id = i;
      d._children = d.children;
       if (d.depth === 9) d.children = null;
    });

    
   // Create Container for D3 Visualizations
    const svgContainer = d3
      .select('#canvas')
      .attr('width', width)
      .attr('height', height)

    // create inner container to help with drag and zoom 
    const svg: any = svgContainer
    .append('g')
    
    // create links
    const gLink = svg
      .append('g')
      .attr('fill', 'none')
      .attr('stroke', '#555')
      .attr('stroke-opacity', 0.9)
      .attr('stroke-width', 1.5);

    // create nodes
    const gNode = svg
      .append('g')
      .attr('cursor', 'pointer')
      .attr('pointer-events', 'all');

    // declare re render funciton to handle collapse and expansion of nodes
    function update(source) {
      const duration = d3.event && d3.event.altKey ? 2500 : 250;
      const nodes = root.descendants().reverse();
      const links = root.links();

      // Compute the new tree layout.
      tree(root);
      let left = root;
      let right = root;
      root.eachBefore((node) => {
        if (node.x < left.x) left = node;
        if (node.x > right.x) right = node;
      });

      //use nodes to detrmine height
      const height = right.x - left.x + margin.top + margin.bottom;

      // transition between past and present
      const transition = svg
        .transition()
        .duration(duration)
        .attr('viewBox', [-margin.left, left.x - margin.top, width, height])
       ;

      // Update the nodes…
      const node = gNode.selectAll('g').data(nodes, (d) => d.id);

      // Enter any new nodes at the parent's previous position.
      const nodeEnter = node
        .enter()
        .append('g')
        .attr('transform', (d) => `translate(${source.y0},${source.x0})`)
        .attr('fill-opacity', 0)
        .attr('stroke-opacity', 1)
        .on('click', (d) => {
          d.children = d.children ? null : d._children;
          update(d);
        });
      
      // paint circles, color based on children
      nodeEnter
        .append('circle')
        .attr('r', 10)
        .attr('fill', (d) => (d._children ?  '#46edf2': '#95B6B7' ))
        .attr('stroke-width', 10)
        .attr('stroke-opacity', 1);
      
      // append node names
      nodeEnter
      .append('text')
          .attr('dy', '.31em')
          .attr('x', '-10')
          .attr('y', '-5')
          .attr('text-anchor','end' )
          .text((d: any) => d.data.name.slice(0,14))
          .style('font-size', `.6rem`)
          .style('fill', 'white')
          .clone(true)
          .lower()
          .attr("stroke-linejoin", "round")
          .attr('stroke', '#646464')
          .attr('stroke-width', 1);

             // display the data in the node on hover
             
      nodeEnter.on('mouseover', function (d: any, i: number): any {
        if (!d.children) {
          d3.select(this)
            .append('text')
            .text(()=>{
              console.log(d)
              return JSON.stringify(d.data)})
            .style('fill', 'white')
            .attr('x',0)
            .attr('y', 0)
            .style('font-size', '.6rem')
            .style('text-align', 'center')
            .attr('stroke', '#646464')
            .attr('id', `popup${i}`);
         }
      });
      
      nodeEnter.on('mouseout', function (d: any, i: number): any {
        d3.select(`#popup${i}`).remove();
      });
        
      // Transition nodes to their new position.
      const nodeUpdate = node
        .merge(nodeEnter)
        .transition(transition)
        .attr('transform', (d) => `translate(${d.y},${d.x})`)
        .attr('fill-opacity', 1)
        .attr('stroke-opacity', 1);

      // Transition exiting nodes to the parent's new position.
      const nodeExit = node
        .exit()
        .transition(transition)
        .remove()
        .attr('transform', (d) => `translate(${source.y},${source.x})`)
        .attr('fill-opacity', 0)
        .attr('stroke-opacity', 0);

      // Update the links…
      const link = gLink.selectAll('path').data(links, (d) => d.target.id);

      // Enter any new links at the parent's previous position.
      const linkEnter = link
        .enter()
        .append('path')
        .attr('d', (d) => {
          const o = { x: source.x0, y: source.y0 };
          return diagonal({ source: o, target: o });
        });

      // Transition links to their new position.
      link.merge(linkEnter).transition(transition).attr('d', diagonal);

      // Transition exiting nodes to the parent's new position.
      link
        .exit()
        .transition(transition)
        .remove()
        .attr('d', (d) => {
          const o = { x: source.x, y: source.y };
          return diagonal({ source: o, target: o });
        });

      // Stash the old positions for transition.
      root.eachBefore((d) => {
        d.x0 = d.x;
        d.y0 = d.y;
      });

    }
  
         //______________ZOOM______________\\

    // Sets starting zoom 
    let zoom = d3.zoom().on('zoom', zoomed);
    svgContainer.call(
      zoom.transform,
      // Changes the initial view, (left, top)
      d3.zoomIdentity.translate(150, 250).scale(0.6)
    );

    // allows the canvas to be zoom-able
    svgContainer.call(
      d3
        .zoom()
        .scaleExtent([0.15, 1.5]) // [zoomOut, zoomIn]
        .on('zoom', zoomed)
    );
    function zoomed(d: any) {
      svg.attr('transform', d3.event.transform);
    }

      // allows the canvas to be draggable
    svg.call(
      d3
        .drag()
        .on('start', dragStarted)
        .on('drag', dragged)
        .on('end', dragEnded)
    );
    function dragStarted(): any {
      d3.select(this).raise();
     svg.attr('cursor', 'grabbing');
    }
    function dragged(d: any): any {
      d3.select(this)
        .attr('dx', (d.x = d3.event.x))
        .attr('dy', (d.y = d3.event.y));
    }
    function dragEnded(): any {
      svg.attr('cursor', 'grab');
    }
    
    // call update on node click
    update(root);
  }, [data]);
  // // set the heights and width of the tree to be passed into treeMap function
  // const width: number = 900;
  // const height: number = 600;

  // // this state allows the canvas to stay at the zoom level on multiple re-renders
  // const [{ x, y, k }, setZoomState]: any = useState({ x: 0, y: 0, k: 0 });
  // useEffect(() => {
  //   setZoomState(d3.zoomTransform(d3.select('#canvas').node()));
  // }, [snapshot.children]);

  // // Create D3 Tree Diagram
  // useEffect(() => {

  //   document.getElementById('canvas').innerHTML = '';

  //   // creating the main svg container for d3 elements
  //   const svgContainer: any = d3
  //     .select('#canvas')
  //     .attr('width', width)
  //     .attr('height', height);

  //   // creating a pseudo-class for reusability
  //   const g: any = svgContainer
  //     .append('g')
  //     .attr('transform', `translate(${x}, ${y}), scale(${k})`); // sets the canvas to the saved zoomState

  //   // creating the tree map
  //   const treeMap: any = d3.tree().nodeSize([width, height]);
  //   // creating the nodes of the tree
  //   const hierarchyNodes: any = d3.hierarchy(snapshots[lastSnap]);
  //   // calling the tree function with nodes created from data
  //   const finalMap: any = treeMap(hierarchyNodes);
  //   // renders the paths onto the component

  //   let paths: any = finalMap.links();
  //   // returns a flat array of objects containing all the nodes and their information
  //   let nodes: any = hierarchyNodes.descendants();

  //   // this creates the paths to each node and its contents in the tree
  //   g.append('g')
  //     .attr('fill', 'none')
  //     .attr('stroke', '#646464')
  //     .attr('stroke-width', 5)
  //     .selectAll('path')
  //     .data(paths)
  //     .enter()
  //     .append('path')
  //     .attr(
  //       'd',
  //       d3
  //         .linkHorizontal()
  //         .x((d: any) => d.y)
  //         .y((d: any) => d.x)
  //     );

  //   // this segment places all the nodes on the canvas
  //   const node: any = g
  //     .append('g')
  //     .attr('stroke-linejoin', 'round') // no clue what this does
  //     .attr('stroke-width', 1)
  //     .selectAll('g')
  //     .data(nodes)
  //     .enter()
  //     .append('g')
  //     .attr('transform', (d: any) => `translate(${d.y}, ${d.x})`)
  //     .attr('class', 'atomNodes');

  //   // for each node that got created, append a circle element
  //   node
  //     .append('circle')
  //     .attr('fill', (d: any) => (d.children ? '#95B6B7' : '#46edf2'))
  //     .attr('r', 50);

  //   // for each node that got created, append a text element that displays the name of the node
  //   node
  //     .append('text')
  //     .attr('dy', '.31em')
  //     .attr('x', (d: any) => (d.children ? -50 : 50))
  //     .attr('text-anchor', (d: any) => (d.children ? 'end' : 'start'))
  //     .text((d: any) => d.data.name)
  //     .style('font-size', `2rem`)
  //     .style('fill', 'white')
  //     .clone(true)
  //     .lower()
  //     .attr('stroke', '#646464')
  //     .attr('stroke-width', 2);

  //   // display the data in the node on hover
  //   node.on('mouseover', function (d: any, i: number): any {
  //     if (!d.children) {
  //       d3.select(this)
  //         .append('text')
  //         .text(JSON.stringify(d.data, undefined, 2))
  //         .style('fill', 'white')
  //         .attr('x', -999)
  //         .attr('y', 100)
  //         .style('font-size', '3rem')
  //         .style('text-align', 'center')
  //         .attr('stroke', '#646464')
  //         .attr('id', `popup${i}`);
  //     }
  //   });

  //   // add mouseOut event handler that removes the popup text
  //   node.on('mouseout', function (d: any, i: number): any {
  //     d3.select(`#popup${i}`).remove();
  //   });

  //   //______________ZOOM______________\\

  //   // Sets starting zoom but breaks keeping currents zoom on state change

  //   // let zoom = d3.zoom().on('zoom', zoomed);
  //   // svgContainer.call(
  //   //   zoom.transform,
  //   //   // Changes the initial view, (left, top)
  //   //   d3.zoomIdentity.translate(150, 250).scale(0.2)
  //   // );

  //   // allows the canvas to be zoom-able
  //   svgContainer.call(
  //     d3
  //       .zoom()
  //       .scaleExtent([0.05, 0.9]) // [zoomOut, zoomIn]
  //       .on('zoom', zoomed)
  //   );
  //   function zoomed(d: any) {
  //     g.attr('transform', d3.event.transform);
  //   }

  //   //_____________DRAG_____________\\
  //   // allows the canvas to be draggable
  //   node.call(
  //     d3
  //       .drag()
  //       .on('start', dragStarted)
  //       .on('drag', dragged)
  //       .on('end', dragEnded)
  //   );

  //   function dragStarted(): any {
  //     d3.select(this).raise();
  //     g.attr('cursor', 'grabbing');
  //   }
  //   function dragged(d: any): any {
  //     d3.select(this)
  //       .attr('dx', (d.x = d3.event.x))
  //       .attr('dy', (d.y = d3.event.y));
  //   }
  //   function dragEnded(): any {
  //     g.attr('cursor', 'grab');
  //   }
  // });

  return (
    <div data-testid="canvas">
  
        <svg id="canvas"></svg>
      </div>
   
  );
};

export default Map;
