import {useSortable} from "@dnd-kit/sortable";
import {CSS} from "@dnd-kit/utilities";
import {Box, Card, Typography} from "@mui/material";
import React, {useEffect, useState} from "react";
import {CardThemes} from "../../enums/CardThemes";

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

    const themeKey = item.theme && CardThemes[item.theme] ? item.theme : "default";
    const themeStyles = CardThemes[themeKey];

    const [windowsWidth, setWindowsWidth] = useState(window.innerWidth);

    useEffect(() => {
        const handleResize = () => setWindowsWidth(window.innerWidth);
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    return (
        <Box ref={setNodeRef} style={style} {...attributes} {...listeners}>
            <Card variant="outlined"
                  sx={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      p: 2,
                      minHeight: windowsWidth <= 1200 ? 60: 90,
                      borderRadius: 2,
                      userSelect: "none",
                      ...themeStyles,
                      touchAction: allowDrag ? 'auto' : 'none',
                      transition: "transform 120ms ease, box-shadow 120ms ease, background-color 120ms ease",
                      "&:hover": {
                          filter: "brightness(0.98)",
                          boxShadow: 3,
                      },
                      "&:active": {
                          transform: "scale(0.99)",
                          boxShadow: 1,
                      },
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                  }}>
                <Typography sx={{fontSize: windowsWidth <= 1200 ? '14px' : '24px'}} noWrap><b>{item.name}</b></Typography>
            </Card>
        </Box>
    );
}