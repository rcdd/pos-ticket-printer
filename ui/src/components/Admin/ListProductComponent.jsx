import React, {useRef, useState} from 'react'
import {arrayMove, rectSortingStrategy, SortableContext} from "@dnd-kit/sortable";
import {closestCenter, DndContext, PointerSensor, TouchSensor, useSensor, useSensors} from "@dnd-kit/core";
import ProductService from "../../services/product.service";
import {ProductComponent} from "../Common/ProductComponent";
import {Box} from "@mui/material";

function ListProductComponent({products, editProduct, updateOrder}) {
    const [productsDraggable, setProductsDraggable] = useState(products);
    const timeoutRef = useRef(null);

    const handleDragStart = () => {
        timeoutRef.current = setTimeout(() => {
            timeoutRef.current = null;
        }, 200);
    }

    const handleDragEnd = (event) => {
        const {active, over} = event;

        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;

            const product = productsDraggable.find((item) => item.id === active.id);
            editProduct(product);
        }

        if (!over || active.id === over.id) return;
        const oldIndex = productsDraggable.findIndex((item) => item.id === active.id);
        const newIndex = productsDraggable.findIndex((item) => item.id === over.id);

        const newOrder = arrayMove(productsDraggable, oldIndex, newIndex).map((item, index) => ({
            ...item,
            position: index,
        }));

        setProductsDraggable(newOrder);

        ProductService.reorder(newOrder).then(() => {
            updateOrder();
        }).catch(
            (error) => {
                console.log(error.response);
                throw Error(error.response.data.message)
            }
        )
    };

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(TouchSensor, {
            activationConstraint: {
                delay: 150,
                tolerance: 10,
            },
        })
    );

    return (
        <DndContext sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}>
            <SortableContext
                items={productsDraggable.map(p => p.id)}
                strategy={rectSortingStrategy}
            >
                <Box
                    sx={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                        gap: 2,
                        px: 2,
                        py: 2,
                    }}
                >
                    {productsDraggable
                        .sort((a, b) => a.position - b.position)
                        .map((item) => (
                            <ProductComponent key={item.id} item={item} allowDrag={false}/>
                        ))}
                </Box>
            </SortableContext>
        </DndContext>
    );
}

export default ListProductComponent
