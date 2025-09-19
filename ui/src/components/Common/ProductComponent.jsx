import {useSortable} from "@dnd-kit/sortable";
import {CSS} from "@dnd-kit/utilities";
import {Box, Card, Typography} from "@mui/material";
import React from "react";

export function ProductComponent({item, allowDrag = true}) {
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
                  sx={{p: 1, fontSize: '12px', textAlign: 'center', cursor: 'pointer', touchAction: allowDrag ? 'auto' : 'none'}}>
                <Typography sx={{fontSize: '14px'}} noWrap><b>{item.name}</b></Typography>

                {/*<CardMedia*/}
                {/*    draggable="false"*/}
                {/*    component="img"*/}
                {/*    image={item.image}*/}
                {/*    alt={item.name}*/}
                {/*    sx={{height: 50, objectFit: 'contain', my: 1}}*/}
                {/*/>*/}
                <Typography sx={{fontSize: '14px', marginTop: 1}}>{(item.price / 100).toFixed(2)}€</Typography>
            </Card>
        </Box>
    );
}