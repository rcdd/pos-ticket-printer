import React, {useEffect, useRef, useState} from 'react'
import {arrayMove, rectSortingStrategy, SortableContext, useSortable} from "@dnd-kit/sortable";
import {closestCenter, DndContext, MouseSensor, TouchSensor, useSensor, useSensors} from "@dnd-kit/core";
import {CSS} from "@dnd-kit/utilities";
import {Box, Button, Stack, Typography} from "@mui/material";
import SwapVertIcon from "@mui/icons-material/SwapVert";
import CheckIcon from "@mui/icons-material/Check";
import ProductService from "../../services/product.service";
import {ProductComponent} from "../Common/ProductComponent";

// Touch: in the normal list a swipe always scrolls and only a long press
// (Android-style) picks a product up; in "Ordenar" mode a short hold is
// enough. Moving the finger before the delay cancels the drag, so swiping
// still scrolls in both modes. Mouse: drag after a few pixels, a click edits.
const LONG_PRESS = {delay: 450, tolerance: 8};
const SORT_PRESS = {delay: 120, tolerance: 6};

function SortableProductCard({item, sorting, onOpen}) {
    const {attributes, listeners, setNodeRef, transform, transition, isDragging} = useSortable({id: item.id});

    return (
        <Box
            ref={setNodeRef}
            style={{transform: transform ? CSS.Transform.toString(transform) : undefined, transition}}
            sx={{
                position: 'relative',
                zIndex: isDragging ? 2 : 'auto',
                // let the browser scroll; the touch sensor takes over only
                // once the hold delay has passed
                touchAction: 'manipulation',
            }}
            {...attributes}
            {...listeners}
        >
            <ProductComponent item={item} sorting={sorting} dragging={isDragging}
                              onClick={sorting ? undefined : () => onOpen(item)}/>
        </Box>
    );
}

function ListProductComponent({products, editProduct, updateOrder}) {
    const [productsDraggable, setProductsDraggable] = useState(products);
    const [sorting, setSorting] = useState(false);
    // a mouse drag ends with a click on the card: don't open the editor then
    const justDraggedRef = useRef(false);
    const [windowsWidth, setWindowsWidth] = useState(window.innerWidth);

    useEffect(() => {
        const handleResize = () => setWindowsWidth(window.innerWidth);
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    useEffect(() => {
        if(products.length === 0) return;

        const initialSortedProducts = [...products].sort((a, b) => a.position - b.position);
        const sortedProducts = initialSortedProducts.map((item, index) => ({
            ...item,
            position: index,
        }));
        setProductsDraggable(sortedProducts);

        reorderProducts(sortedProducts);
    }, []);

    const handleDragStart = () => {
        justDraggedRef.current = true;
        navigator.vibrate?.(25);
    };

    const handleDragEnd = (event) => {
        setTimeout(() => {
            justDraggedRef.current = false;
        }, 0);

        const {active, over} = event;
        if (!over || active.id === over.id) return;
        const oldIndex = productsDraggable.findIndex((item) => item.id === active.id);
        const newIndex = productsDraggable.findIndex((item) => item.id === over.id);

        const newOrder = arrayMove(productsDraggable, oldIndex, newIndex).map((item, index) => ({
            ...item,
            position: index,
        }));

        setProductsDraggable(newOrder);

        reorderProducts(newOrder);
    };

    const handleOpen = (product) => {
        if (justDraggedRef.current) return;
        editProduct(product);
    };

    const reorderProducts = (sortedProducts) => {
        ProductService.reorder(sortedProducts).then(() => {
            updateOrder();
        }).catch(
            (error) => {
                console.log(error.response);
                throw Error(error.response.data.message)
            }
        )
    }

    const sensors = useSensors(
        useSensor(MouseSensor, {activationConstraint: {distance: 6}}),
        useSensor(TouchSensor, {activationConstraint: sorting ? SORT_PRESS : LONG_PRESS})
    );

    const compact = windowsWidth < 1200;

    return (
        <>
            <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}
                   sx={{px: 1, pt: 1.5, flexWrap: 'wrap', rowGap: 1}}>
                <Typography variant="body2" color="text.secondary">
                    {sorting
                        ? 'Arraste os produtos para a ordem que quer no POS.'
                        : 'Toque para editar · mantenha premido para mover.'}
                </Typography>
                <Button
                    size="small"
                    variant={sorting ? 'contained' : 'outlined'}
                    startIcon={sorting ? <CheckIcon/> : <SwapVertIcon/>}
                    onClick={() => setSorting((s) => !s)}
                >
                    {sorting ? 'Concluído' : 'Ordenar'}
                </Button>
            </Stack>
            <DndContext sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragStart={handleDragStart}
                        onDragEnd={handleDragEnd}
                        onDragCancel={handleDragEnd}>
                <SortableContext
                    items={productsDraggable.map(p => p.id)}
                    strategy={rectSortingStrategy}
                >
                    <Box
                        sx={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(' + (compact ? '150px' : '250px') + ', 1fr))',
                            gap: 1,
                            px: 1,
                            py: 2,
                        }}
                    >
                        {[...productsDraggable]
                            .sort((a, b) => a.position - b.position)
                            .map((item) => (
                                <SortableProductCard key={item.id} item={item} sorting={sorting} onOpen={handleOpen}/>
                            ))}
                    </Box>
                </SortableContext>
            </DndContext>
        </>
    );
}

export default ListProductComponent
