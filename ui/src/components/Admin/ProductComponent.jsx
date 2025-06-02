import {useSortable} from "@dnd-kit/sortable";
import {CSS} from "@dnd-kit/utilities";
import {Box, Card, CardMedia, Typography} from "@mui/material";
import React from "react";

export function ProductComponent({item}) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
    } = useSortable({id: item.id});

    const style = {
        transform: transform ? CSS.Transform.toString(transform) : undefined,
        transition
    };

    return (
        <Box ref={setNodeRef} style={style} {...attributes} {...listeners}>
            <Card variant="outlined"
                  sx={{p: 2, textAlign: 'center', cursor: 'pointer'}}>
                <Typography variant="h6" noWrap>{item.name}</Typography>
                <CardMedia
                    draggable="false"
                    component="img"
                    image={item.image}
                    alt={item.name}
                    sx={{height: 80, objectFit: 'contain', my: 1}}
                />
                <Typography variant="h6">{(item.price / 100).toFixed(2)}€</Typography>
            </Card>
        </Box>
    );
}